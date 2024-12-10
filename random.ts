// Storage for discovered notes
// const noteStorage = new Map<string, ExtendedNote[]>();

// class NoteDiscoveryService
//   implements L2BlockStreamEventHandler, L2BlockStreamLocalDataProvider
// {
//   private running = false;
//   private blockStream: L2BlockStream;
//   private log = createDebugLogger("note-discovery");
//   private lastProcessedBlock = INITIAL_L2_BLOCK_NUM - 1;

//   constructor(
//     private node: AztecNode,
//     private pollingIntervalMs: number = 1000
//   ) {
//     this.blockStream = new L2BlockStream(this.node, this, {
//       pollIntervalMS: this.pollingIntervalMs,
//     });
//   }

//   public async start() {
//     if (this.running) return;
//     this.running = true;

//     this.log.info("Starting note discovery service");
//     await this.blockStream.start();
//   }

//   public async stop() {
//     this.running = false;
//     await this.blockStream.stop();
//     this.log.info("Stopped note discovery service");
//   }

//   public async handleBlockStreamEvent(
//     event: L2BlockStreamEvent
//   ): Promise<void> {
//     switch (event.type) {
//       case "blocks-added":
//         await this.processNewBlocks(event.blocks);
//         break;
//       case "chain-pruned":
//         await this.handleChainReorg(event.blockNumber);
//         break;
//     }
//   }

//   private async processNewBlocks(blocks: any[]) {
//     for (const block of blocks) {
//       this.log.info(`Processing block ${block.number}`);

//       // For each registered account
//       for (const [addressStr, ivpk_m] of accountStorage.entries()) {
//         const address = AztecAddress.fromString(addressStr);
//         //will be for each contract that is registered in their addressbook

//         // Create filter for incoming notes
//         //need to figure out what the scopes actually mean.
//         const filter: IncomingNotesFilter = {
//           contractAddress: address, // this would be the contract address
//           owner: address,
//         };

//         try {
//           // Query node for notes
//           const notes = await this.node.getIncomingNotes(filter);

//           // Store discovered notes
//           if (notes.length > 0) {
//             const existingNotes = noteStorage.get(addressStr) || [];
//             noteStorage.set(addressStr, [...existingNotes, ...notes]);

//             this.log.info(
//               `Discovered ${notes.length} new notes for address ${addressStr}`
//             );
//           }
//         } catch (error) {
//           this.log.error(
//             `Error processing notes for address ${addressStr}: ${error}`
//           );
//         }
//       }

//       this.lastProcessedBlock = block.number;
//     }
//   }

//   private async handleChainReorg(blockNumber: number) {
//     this.log.info(`Chain reorg detected at block ${blockNumber}`);

//     // Remove notes after the reorg point
//     for (const [addressStr, notes] of noteStorage.entries()) {
//       const filteredNotes = notes.filter(
//         (note) => note.blockNumber <= blockNumber
//       );
//       noteStorage.set(addressStr, filteredNotes);
//     }

//     this.lastProcessedBlock = blockNumber;
//   }

//   async getL2BlockHash(blockNumber: number): Promise<Fr> {
//     return await this.node.getL2BlockHash(blockNumber);
//   }

//   async getL2Tips(): Promise<L2Tips> {
//     return await this.node.getL2Tips();
//   }
// }

// // Initialize node connection and note discovery service
// let noteDiscoveryService: NoteDiscoveryService;

// async function initializeServices(nodeUrl: string) {
//   const node = new AztecNode(nodeUrl);
//   noteDiscoveryService = new NoteDiscoveryService(node);
//   await noteDiscoveryService.start();
// }

// API Endpoints
