import {
  type AztecNode,
  L2BlockStream,
  type L2BlockStreamEvent,
  type L2BlockStreamEventHandler,
  type PublicKey,
  type L1NotePayload,
  type Note,
} from "@aztec/circuit-types";
import { INITIAL_L2_BLOCK_NUM, AztecAddress } from "@aztec/circuits.js";
import { type L2TipsStore } from "../kv-store/src/stores";
import { type AcirSimulator } from "../simulator/src/client/simulator";
import { Fr } from "@aztec/foundation/fields";

// Minimal in-memory database to track notes
interface NoteEntry {
  note: Note;
  contractAddress: AztecAddress;
  storageSlot: Fr;
  noteType: number;
  blockNumber: number;
  nullified: boolean;
}

export class SmolPXE implements L2BlockStreamEventHandler {
  private running = false;
  private initialSyncBlockNumber = INITIAL_L2_BLOCK_NUM - 1;
  private blockStream: L2BlockStream;

  // In-memory note storage
  private notes: Map<string, NoteEntry[]> = new Map();
  private registeredAccounts: Set<string> = new Set();
  private registeredContracts: Map<string, Set<string>> = new Map(); // contract -> storage slots

  constructor(
    private node: AztecNode,
    private simulator: AcirSimulator,
    private l2TipsStore: L2TipsStore,
    config: { l2BlockPollingIntervalMS?: number; l2StartingBlock?: number } = {}
  ) {
    this.blockStream = new L2BlockStream(this.node, this.l2TipsStore, this, {
      pollIntervalMS: config.l2BlockPollingIntervalMS,
      startingBlock: config.l2StartingBlock,
    });
  }

  // Register an account to track notes for
  public registerAccount(publicKey: PublicKey) {
    this.registeredAccounts.add(publicKey.toString());
  }

  // Register a contract and storage slot to track
  public registerContractSlot(contractAddress: AztecAddress, storageSlot: Fr) {
    const contractKey = contractAddress.toString();
    if (!this.registeredContracts.has(contractKey)) {
      this.registeredContracts.set(contractKey, new Set());
    }
    this.registeredContracts.get(contractKey)!.add(storageSlot.toString());
  }

  // Check if we're tracking this contract and slot
  private isTrackedContractSlot(
    contractAddress: AztecAddress,
    storageSlot: Fr
  ): boolean {
    const contractKey = contractAddress.toString();
    const slots = this.registeredContracts.get(contractKey);
    return slots?.has(storageSlot.toString()) ?? false;
  }

  // Process a note payload to see if it's for one of our registered accounts
  private async processNotePayload(
    payload: L1NotePayload,
    blockNumber: number
  ): Promise<void> {
    // Skip if we're not tracking this contract/slot
    if (
      !this.isTrackedContractSlot(payload.contractAddress, payload.storageSlot)
    ) {
      return;
    }

    try {
      // Try to decrypt the note with each registered account
      for (const accountKey of this.registeredAccounts) {
        const publicKey = PublicKey.fromString(accountKey);

        // Attempt to decrypt the note (you'll need to implement this based on your needs)
        const note = await this.simulator.decryptNote(payload, publicKey);

        if (note) {
          // Store the decrypted note
          const noteEntry: NoteEntry = {
            note,
            contractAddress: payload.contractAddress,
            storageSlot: payload.storageSlot,
            noteType: payload.noteTypeId,
            blockNumber,
            nullified: false,
          };

          const key = `${accountKey}-${payload.contractAddress.toString()}`;
          const existingNotes = this.notes.get(key) ?? [];
          existingNotes.push(noteEntry);
          this.notes.set(key, existingNotes);

          console.log("Found note:", {
            contractAddress: payload.contractAddress.toString(),
            storageSlot: payload.storageSlot.toString(),
            noteType: payload.noteTypeId,
            blockNumber,
          });
        }
      }
    } catch (err) {
      // Note couldn't be decrypted
      console.debug("Failed to decrypt note:", err);
    }
  }

  public async handleBlockStreamEvent(
    event: L2BlockStreamEvent
  ): Promise<void> {
    await this.l2TipsStore.handleBlockStreamEvent(event);

    if (event.type === "blocks-added") {
      console.log(
        `Processing blocks ${event.blocks[0].number} to ${
          event.blocks.at(-1)!.number
        }`
      );

      // Process each block
      for (const block of event.blocks) {
        // Get the block's note payloads
        const payloads = await this.node.getL1NotePayloads(block.number);

        // Process each payload
        for (const payload of payloads) {
          await this.processNotePayload(payload, block.number);
        }
      }
    }
  }

  // Get notes for a specific account and contract
  public getNotes(
    account: PublicKey,
    contractAddress: AztecAddress
  ): NoteEntry[] {
    const key = `${account.toString()}-${contractAddress.toString()}`;
    return this.notes.get(key) ?? [];
  }

  // Mark a note as nullified
  public nullifyNote(noteHash: Fr) {
    // Iterate through all notes to find and mark the one with matching hash
    for (const notes of this.notes.values()) {
      const note = notes.find((n) => n.note.noteHash.equals(noteHash));
      if (note) {
        note.nullified = true;
        break;
      }
    }
  }

  public async start() {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.blockStream.start();
    console.log("SmolPXE started");
  }

  public async stop() {
    this.running = false;
    await this.blockStream.stop();
    console.log("SmolPXE stopped");
  }
}
