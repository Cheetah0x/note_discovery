import cors from "cors";
import { AztecAddress, Point, Fr } from "@aztec/circuits.js";
import { UniqueNote, PXE, createPXEClient } from "@aztec/aztec.js";
import express, { Request, Response } from "express";
import WebSocket, { WebSocketServer } from "ws";
import { EventEmitter } from "events";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));

interface NotificationSubscriber {
  address: string;
  socket: WebSocket;
}

// Interfaces for notes
interface NoteStore {
  owner: string;
  note: UniqueNote;
  blockNumber: number;
}

interface PlainNote {
  contractAddress: string;
  storageSlot: string;
  noteTypeId: string;
  txHash: string;
  nonce: string;
  items: string[];
}

interface NoteRecord {
  owner: string;
  note: PlainNote;
  blockNumber: number;
}

//TODO: Figure out auth to ensure people can only access their account

// Storage for registered accounts
const accountStorage = new Map<string, Point>();

// In-memory database for storing notes
class InMemoryDB {
  private notes: Map<string, NoteStore[]> = new Map();

  public storeNote(note: NoteStore): void {
    const existingNotes = this.notes.get(note.owner) || [];
    existingNotes.push(note);
    this.notes.set(note.owner, existingNotes);
  }

  public getNotesByOwner(owner: string): NoteStore[] {
    return this.notes.get(owner) || [];
  }

  public clearNotes(owner: string): void {
    this.notes.delete(owner);
  }
}

const db = new InMemoryDB();

// Helper function to convert a UniqueNote to a plain JSON-friendly object
function convertUniqueNoteToPlainObject(uniqueNote: UniqueNote): PlainNote {
  return {
    contractAddress: uniqueNote.contractAddress.toString(),
    storageSlot: uniqueNote.storageSlot.toString(),
    noteTypeId: uniqueNote.noteTypeId.toString(),
    txHash: uniqueNote.txHash.toString(),
    nonce: uniqueNote.nonce.toString(),
    items: uniqueNote.note?.items.map((item) => item.toString()) || [], // Ensure items is serialized as an array
  };
}

class NotificationManager {
  private subscribers: Map<string, WebSocket> = new Map();

  public subscribe(address: string, socket: WebSocket): void {
    this.subscribers.set(address, socket);
  }

  public unsubscribe(address: string): void {
    this.subscribers.delete(address);
  }

  public notify(address: string, note: NoteRecord): void {
    const socket = this.subscribers.get(address);
    if (socket) {
      socket.send(
        JSON.stringify({
          type: "NEW_NOTE",
          data: note,
        })
      );
    }
  }
}

const notificationManager = new NotificationManager();

// NoteListener Class
class NoteListener {
  private pxe: PXE;
  private isRunning: boolean = false;
  private processedNoteHashes: Set<string> = new Set();

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
    const filter = { owner: this.accountAddress };
    const newNotes = await this.pxe.getIncomingNotes(filter);

    for (const note of newNotes) {
      if (this.processedNoteHashes.has(note.txHash.toString())) continue;

      const blockNumber = await this.pxe.getBlockNumber();
      const noteRecord: NoteStore = {
        owner: this.accountAddress.toString(),
        note,
        blockNumber: blockNumber ?? 0,
      };

      db.storeNote(noteRecord);
      this.processedNoteHashes.add(note.txHash.toString());

      //send notifcation for new note
      const processedNote: NoteRecord = {
        owner: noteRecord.owner,
        note: convertUniqueNoteToPlainObject(noteRecord.note),
        blockNumber: noteRecord.blockNumber,
      };

      notificationManager.notify(noteRecord.owner, processedNote);
    }
  }
}

// Route to register an account
app.post("/registerAccount", async (req, res) => {
  const { address, ivpk_m } = req.body;
  const normalizedAddress = address.toLowerCase();

  accountStorage.set(normalizedAddress, ivpk_m);
  console.log(`Registered account: ${normalizedAddress}`);

  const pxeUrl = "http://localhost:8080";
  const accountAddress = AztecAddress.fromString(address);

  const noteListener = new NoteListener(pxeUrl, accountAddress);
  noteListener.start();

  res.status(200).send("Account registered and listening for notes.");
});

// Route to fetch raw and processed notes
app.post("/getNotes", (req: Request, res: Response) => {
  const { address } = req.body;
  const normalizedAddress = address.toLowerCase();

  const rawNotes = db.getNotesByOwner(normalizedAddress);

  const processedNotes = rawNotes.map((note) => ({
    owner: note.owner,
    blockNumber: note.blockNumber,
    note: convertUniqueNoteToPlainObject(note.note),
  }));

  res.status(200).json(processedNotes);
});

// Route to clear notes for an owner
app.post("/clearNotes", (req: Request, res: Response) => {
  const { address } = req.body;
  const normalizedAddress = address.toLowerCase();

  db.clearNotes(normalizedAddress);
  res.status(200).send(`Cleared notes for owner: ${normalizedAddress}`);
});

const wss = new WebSocketServer({ port: 8081 });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "SUBSCRIBE") {
        notificationManager.subscribe(data.address, ws);
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  });

  ws.on("close", () => {
    // Clean up subscribers when connection closes
    //figure out how to clean up subscribers
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
