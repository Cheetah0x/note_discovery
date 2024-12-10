// import express from "express";
// import cors from "cors";
// import {
//   CompleteAddress,
//   Point,
//   AztecAddress,
//   Fr,
//   INITIAL_L2_BLOCK_NUM,
// } from "@aztec/circuits.js";
// import {
//   type AztecNode,
//   L2BlockStream,
//   type L2BlockStreamEvent,
//   type L2BlockStreamEventHandler,
// } from "@aztec/circuit-types";
// import { createDebugLogger, DebugLogger } from "@aztec/foundation/log";
// import { PXE } from "@aztec/aztec.js";
// import { L2TipsStore } from "./kv-store/src/stores/l2_tips_store";

// const app = express();
// app.use(express.json());
// app.use(cors({ origin: "http://localhost:5173" }));

// // const client = await createAndStartTelemetryClient(getTelemetryClientConfig());
// // const node = await createAztecNode(aztecNodeConfig, Client);
// // const pxe = new createAztecPXE(node);

// //think about what really needs to be done.
// //the aztec node is already running. Find out how the PXE listens to the node.

// //logic starts here

// interface NoteRecord {
//   owner: string;
//   note: string; // You might want to adjust this type based on your needs
//   blockNumber: number;
// }

// interface Database {
//   storeNote(note: NoteRecord): void;
//   getNotesByOwner(owner: string): NoteRecord[];
// }

// class InMemoryDB implements Database {
//   private notes: Map<string, NoteRecord[]> = new Map();

//   storeNote(note: NoteRecord): void {
//     const existingNotes = this.notes.get(note.owner) || [];
//     existingNotes.push(note);
//     this.notes.set(note.owner, existingNotes);
//   }

//   getNotesByOwner(owner: string): NoteRecord[] {
//     return this.notes.get(owner) || [];
//   }
// }

// export class Synchronizer implements L2BlockStreamEventHandler {
//   private running = false;
//   private initialSyncBlobkNumber = INITIAL_L2_BLOCK_NUM - 1;
//   private log: DebugLogger;
//   protected readonly blockStream: L2BlockStream;

//   constructor(
//     private node: AztecNode,
//     private db: Database,
//     private l2TipsStore: L2TipsStore,
//     // config: Partial<Pick<PXEConfig, "l2BlockPollingIntervalMS" | "l2StartingBlock">> = {},
//     logSuffix?: string
//   ) {
//     this.log = createDebugLogger("synchronizer");
//     this.blockStream = this.createBlockStream();
//   }

//   // protected createBlockStream(
//   //   config: Partial<
//   //     Pick<PXEConfig, "l2BlockPollingIntervalMS" | "l2StartingBlock">
//   //   >
//   // ) {
//   //   return new L2BlockStream(this.node, this.l2TipsStore, this, {
//   //     pollIntervalMS: config.l2BlockPollingIntervalMS,
//   //     startingBlock: config.l2StartingBlock,
//   //   });

//   //do not worry about the handlestreamevent, apart from blocks added.

//   // public async handleBlockStreamEvent(
//   //   event: L2BlockStreamEvent
//   // ): Promise<void> {
//   //   await this.l2TipsStore.handleBlockStreamEvent(event);

//   //   this.log.verbose(
//   //     `Processing blocks ${event.blocks[0].number} to ${
//   //       event.blocks.at(-1)!.number
//   //     }`
//   //   );
//   //   await this.db.setHeader(event.blocks.at(-1)!.header);
//   // }

//   //start the good ole thing
//   public async start() {
//     if (this.running) return;
//     this.running = true;

//     this.log.info("Starting note discovery service");
//     await this.blockStream.start();

//     /
//   }
// }

// // Storage for accounts and their viewing keys
// const accountStorage = new Map<string, Point>();

// app.post("/registerAccount", (req, res) => {
//   const { address, ivpk_m } = req.body;
//   console.log("Received data", {
//     address: address.toString(),
//     ivpk_m: ivpk_m.toString(),
//   });

//   accountStorage.set(address.toString(), ivpk_m);

//   res.status(200).send("Account registered for note discovery");
// });

// app.get("/getAccountInfo/:address", (req, res) => {
//   const ivpk_m = accountStorage.get(req.params.address);
//   if (!ivpk_m) {
//     res.status(404).send("Account not found");
//   } else {
//     res.status(200).json({ ivpk_m });
//   }
// });

// // New endpoint to get discovered notes for an address
// app.get("/getNotes/:address", (req, res) => {});

// // Start the server and initialize services
// const PORT = 3000;
// const AZTEC_NODE_URL = "http://localhost:8079"; // Default Aztec sandbox URL

// app.listen(PORT, async () => {
//   console.log(`Server is running on port ${PORT}`);
//   console.log("Note discovery service initialized");
// });
