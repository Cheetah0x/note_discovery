import cors from "cors";
import {
  CompleteAddress,
  Point,
  AztecAddress,
  Fr,
  INITIAL_L2_BLOCK_NUM,
} from "@aztec/circuits.js";
import {
  type AztecNode,
  IncomingNotesFilter,
  L2BlockStream,
  type L2BlockStreamEvent,
  type L2BlockStreamEventHandler,
} from "@aztec/circuit-types";
import { createDebugLogger, DebugLogger } from "@aztec/foundation/log";
import { createPXEClient, PXE } from "@aztec/aztec.js";
import { L2TipsStore } from "./kv-store/src/stores/l2_tips_store";
import { toHex } from "viem";
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));

// const client = await createAndStartTelemetryClient(getTelemetryClientConfig());
// const node = await createAztecNode(aztecNodeConfig, Client);
// const pxe = new createAztecPXE(node);

//think about what really needs to be done.
//the aztec node is already running. Find out how the PXE listens to the node.

//logic starts here

// Storage for accounts and their viewing keys
const accountStorage = new Map<string, Point>();
let noteListener: NoteListener | null = null;

// Add this near the top with other global variables

app.post("/registerAccount", async (req, res) => {
  const { address, ivpk_m } = req.body;
  console.log("Received data", {
    address: address.toString(),
    ivpk_m: ivpk_m.toString(),
  });

  const normalizedAddress = address.toString().toLowerCase();

  accountStorage.set(normalizedAddress, ivpk_m);

  console.log("Request address length:", address.length);

  // Start listening for notes for this newly registered address
  await startNoteListening(address);

  res.status(200).send("Account registered for note discovery");
});

// Helper function to start note listening
async function startNoteListening(address: string) {
  // Stop existing listener if any
  if (noteListener) {
    noteListener.stop();
  }

  const pxeUrl = "http://localhost:8080";
  const accountAddress = AztecAddress.fromString(address);

  noteListener = new NoteListener(pxeUrl, accountAddress);
  await noteListener.start();
}

interface NoteRecord {
  owner: string;
  noteHash: string;
  contractAddress: string;
  storageSlot: string;
  noteType: string;
  noteString: string;
  blockNumber: number;
}

interface Database {
  storeNote(note: NoteRecord): void;
  getNotesByOwner(owner: string): NoteRecord[];
}

class InMemoryDB implements Database {
  //make private
  public notes: Map<string, NoteRecord[]> = new Map();

  storeNote(note: NoteRecord): void {
    const existingNotes = this.notes.get(note.owner) || [];
    existingNotes.push(note);
    this.notes.set(note.owner, existingNotes);
  }

  getNotesByOwner(owner: string): NoteRecord[] {
    return this.notes.get(owner) || [];
  }
}

const db = new InMemoryDB();
class NoteListener {
  private pxe: PXE;
  private lastProcessedBlock: number = 0;
  private isRunning: boolean = false;
  private processedNoteHashes: Set<string> = new Set(); //track processed notes
  // private log: DebugLogger;

  constructor(
    private readonly pxeUrl: string,
    private readonly accountAddress: AztecAddress,
    private readonly pollingIntervalMs: number = 1000
  ) {
    this.pxe = createPXEClient(pxeUrl);
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.checkForNewNotes();
      } catch (err) {
        console.error("Error checking for notes:", err);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.pollingIntervalMs)
      );
    }
  }

  public stop() {
    this.isRunning = false;
  }

  private async checkForNewNotes() {
    // Create filter for notes after our last processed block
    const filter: IncomingNotesFilter = {
      owner: this.accountAddress,
    };

    // Query for new notes
    const newNotes = await this.pxe.getIncomingNotes(filter);

    // Process new notes
    for (const note of newNotes) {
      // Skip if we've already processed this note
      if (this.processedNoteHashes.has(note.txHash.toString())) {
        continue;
      }

      const blockNumber = await this.pxe.getBlockNumber();

      // Handle new note - e.g. log it, store it, trigger notifications etc.
      console.log("New note received:", {
        noteHash: note.txHash,
        contractAddress: note.contractAddress,
        storageSlot: note.storageSlot,
        noteType: note.noteTypeId,
        noteString: note.toString(),
        blockNumber: blockNumber,
        buffer: note.toBuffer().toString("hex"),
      });

      //create a record of the note
      // Create NoteRecord to store in db
      const noteRecord: NoteRecord = {
        owner: this.accountAddress.toString(),
        noteHash: note.txHash.toString(),
        contractAddress: note.contractAddress.toString(),
        storageSlot: note.storageSlot.toString(),
        noteType: note.noteTypeId.toString(),
        noteString: note.toString(),
        blockNumber: blockNumber ?? 0,
      };

      db.storeNote(noteRecord);
      // Track that we've processed this note
      this.processedNoteHashes.add(note.txHash.toString());

      console.log(
        "DB keys and their lengths:",
        Array.from(db.notes.keys()).map((key) => [key, key.length])
      );

      // Update last processed block if this note is from a later block
      // if (note. > this.lastProcessedBlock) {
      //   this.lastProcessedBlock = note.blockNumber;
      // }
    }
  }
}

app.get("/getAccountInfo/:address", (req, res) => {
  const ivpk_m = accountStorage.get(req.params.address);
  if (!ivpk_m) {
    res.status(404).send("Account not found");
  } else {
    res.status(200).json({ ivpk_m });
  }
});

// Update the existing route to handle POST requests
app.post("/getNotes", (req: Request, res: Response) => {
  const { address } = req.body; // Extract address from request body
  const normalizedAddress = address.toString().toLowerCase();
  console.log("Received address:", normalizedAddress);
  const notes = db.getNotesByOwner(normalizedAddress);
  console.log("Notes in request:", notes);
  res.status(200).json({ notes });
});

// Start the server and initialize services
const PORT = 3000;
const AZTEC_NODE_URL = "http://localhost:8079"; // Default Aztec sandbox URL

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Note discovery service initialized");
});
