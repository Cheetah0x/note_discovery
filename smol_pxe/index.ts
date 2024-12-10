import { createAztecNode } from "@aztec/aztec-node";
import { createSimulator } from "@aztec/simulator";
import { createL2TipsStore } from "../kv-store/src/stores";
import { SmolPXE } from "./note_listener";
import { AztecAddress } from "@aztec/circuits.js";
import { Fr } from '@aztec/foundation/fields';

async function main() {
  // Connect to your local Aztec node
  const node = await createAztecNode({ serverUrl: "http://localhost:8079" });

  // Create simulator for note decryption
  const simulator = await createSimulator();

  // Create L2 tips store for tracking chain state
  const l2TipsStore = await createL2TipsStore();

  // Create the PXE
  const pxe = new SmolPXE(
    node,
    simulator,
    l2TipsStore,
    {
      l2BlockPollingIntervalMS: 1000, // Poll every second
    }
  );

  // Register your account's public key
  const myPublicKey = /* get your public key from wallet */;
  pxe.registerAccount(myPublicKey);

  // Register contracts and storage slots you want to track
  // Example: Register a token contract's balance slot
  const tokenContract = AztecAddress.fromString("0x1234..."); // Replace with actual contract address
  const balanceSlot = Fr.fromString("0"); // Example storage slot for balance
  
  pxe.registerContractSlot(tokenContract, balanceSlot);

  // Start listening for notes
  await pxe.start();

  // Example: Periodically check for new notes
  setInterval(() => {
    const notes = pxe.getNotes(myPublicKey, tokenContract);
    console.log('Current notes:', notes.length);
    
    // Filter for non-nullified notes only
    const activeNotes = notes.filter(n => !n.nullified);
    console.log('Active notes:', activeNotes.length);
  }, 5000);

  // Keep the process running
  process.on("SIGINT", async () => {
    console.log("Stopping PXE...");
    await pxe.stop();
    process.exit(0);
  });
}

main().catch(console.error);
