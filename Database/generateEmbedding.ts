import { Client } from "pg";
import OpenAI from "openai";
import dotenv from "dotenv";

// Chargement des variables d'environnement
dotenv.config();

const client = new Client({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "postgres",
  database: process.env.DB_NAME || "your_db",
  password: process.env.DB_PASSWORD || "your_password",
  port: parseInt(process.env.DB_PORT || "5432"),
});

// Fonction pour générer les embeddings avec OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      input: text,
      model: "text-embedding-ada-002",
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Erreur lors de la génération de l'embedding:", error);
    throw error;
  }
}

// Fonction pour mettre à jour les embeddings des clients
async function updateClientEmbeddings() {
  console.log("🔄 Mise à jour des embeddings clients...");
  const res = await client.query("SELECT id, firstname, lastname, email FROM clients");
  for (const row of res.rows) {
    const text = `${row.firstname} ${row.lastname} ${row.email}`;
    const embedding = await generateEmbedding(text);
    await client.query(
      "UPDATE clients SET embedding = $1 WHERE id = $2",
      [embedding, row.id]
    );
  }
  console.log("✅ Embeddings clients mis à jour !");
}

// Fonction pour mettre à jour les embeddings des projets
async function updateProjectEmbeddings() {
  console.log("🔄 Mise à jour des embeddings projets...");
  const res = await client.query("SELECT id, name, description FROM projects");
  for (const row of res.rows) {
    const text = `${row.name} ${row.description || ''}`;
    const embedding = await generateEmbedding(text);
    await client.query(
      "UPDATE projects SET embedding = $1 WHERE id = $2",
      [embedding, row.id]
    );
  }
  console.log("✅ Embeddings projets mis à jour !");
}

// Fonction pour mettre à jour les embeddings des devis
async function updateQuotationEmbeddings() {
  console.log("🔄 Mise à jour des embeddings devis...");
  const res = await client.query(`
    SELECT q.id, q.reference, q.notes, p.name as project_name 
    FROM quotations q
    JOIN projects p ON q.project_id = p.id
  `);
  for (const row of res.rows) {
    const text = `Devis ${row.reference} pour le projet ${row.project_name}. ${row.notes || ''}`;
    const embedding = await generateEmbedding(text);
    await client.query(
      "UPDATE quotations SET embedding = $1 WHERE id = $2",
      [embedding, row.id]
    );
  }
  console.log("✅ Embeddings devis mis à jour !");
}

// Fonction pour mettre à jour les embeddings des factures
async function updateInvoiceEmbeddings() {
  console.log("🔄 Mise à jour des embeddings factures...");
  const res = await client.query(`
    SELECT i.id, i.reference, i.notes, p.name as project_name 
    FROM invoices i
    JOIN projects p ON i.project_id = p.id
  `);
  for (const row of res.rows) {
    const text = `Facture ${row.reference} pour le projet ${row.project_name}. ${row.notes || ''}`;
    const embedding = await generateEmbedding(text);
    await client.query(
      "UPDATE invoices SET embedding = $1 WHERE id = $2",
      [embedding, row.id]
    );
  }
  console.log("✅ Embeddings factures mis à jour !");
}

// Fonction principale pour mettre à jour tous les embeddings
async function updateAllEmbeddings() {
  try {
    console.log("🚀 Démarrage de la mise à jour des embeddings...");
    await client.connect();
    
    // Mise à jour des embeddings pour chaque table
    await updateClientEmbeddings();
    await updateProjectEmbeddings();
    await updateQuotationEmbeddings();
    await updateInvoiceEmbeddings();
    
    console.log("🎉 Tous les embeddings ont été mis à jour avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour des embeddings:", error);
  } finally {
    await client.end();
  }
}

// Option pour permettre la mise à jour d'une seule table via ligne de commande
const targetTable = process.argv[2];
if (targetTable) {
  (async () => {
    try {
      await client.connect();
      
      switch (targetTable.toLowerCase()) {
        case "clients":
          await updateClientEmbeddings();
          break;
        case "projects":
          await updateProjectEmbeddings();
          break;
        case "quotations":
          await updateQuotationEmbeddings();
          break;
        case "invoices":
          await updateInvoiceEmbeddings();
          break;
        default:
          console.error(`Table inconnue: ${targetTable}`);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      await client.end();
    }
  })();
} else {
  updateAllEmbeddings();
}

export {
  generateEmbedding,
  updateClientEmbeddings,
  updateProjectEmbeddings,
  updateQuotationEmbeddings,
  updateInvoiceEmbeddings,
  updateAllEmbeddings
};
