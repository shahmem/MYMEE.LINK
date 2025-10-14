// scripts/seedTokens.js - Run this once to populate tokens in database
require("dotenv").config();
const mongoose = require("mongoose");
const Token = require("../models/Token");

const TOKENS = [
  "K8L3Z9TQ", "A7P5R1XD", "ZQ3H9MKT", "B6N2L0JW", "T9X1E7CU",
  "F2D6S5QP", "R7Y8G4WM", "H3N1K5ZT", "M4J9V2LP", "P8B6X0QA",
  "N7C4E2UF", "G5R1H8LM", "Q2T9S6DW", "X3V7B4ZN", "J1L5K9PG",
  "C8M2Y6RT", "D7H9F3VX", "E1P6Z0NB", "L4S8G2KJ", "W5Q3D9TM",
  "Y0N7B1LH", "V9K6X3PA", "U2J8M5RW", "O3L1C7YZ", "I4F9S0GN",
  "T5B2H6QJ", "R1Z8E7XP", "K6M3N4VW", "A9D2G5LY", "P7X0T8CN",
  "Z8V1S5MB", "F3C9Q7LH", "N2E6R4KP", "H0Y5J8TD", "M1G7X9WU",
  "B9K4N2EZ", "Q6P8D1VF", "X5L3T0RY", "C7M9W8GH", "D2J4B6KA",
  "E8S1Z3NP", "L0F5R7QC", "W9T2Y8JD", "Y3H6M5LU", "V7K9C0XP",
  "U1B8N4SE", "O6D3G2VW", "I9J5T7LH", "T4M1P8QR", "R8F6Z2NK",
  "K3C0H5YW", "A5V8X9BL", "P2S7D4GJ", "Z9E3M1TN", "F0R6L8KP",
  "N4B7W2QV", "H8X5J9DA", "M2G1Y3RC", "B5N0V7LU", "Q7P9T4MH",
  "X1L8K2ZW", "C4S5E3GP", "D6M9Y7FB", "E9J1N0XV", "L8R3Z5HK",
  "W2C9B4ND", "Y7T0F8PQ", "V1K5H6ME", "U9S2J7LG", "O5G3X1VR",
  "I2F6Q8CB", "T6D7P0NW", "R0Z9L4KY", "K1M3S8HJ", "A3V9C5TR",
  "P4E2N6QX", "Z7R5B8MW", "F8L0Y3JP", "N9C1W5DH", "H6X7M2VA",
  "M3G8K9SQ", "B1N4T7RF", "Q8P0Z2LC", "X9L6H3DW", "C0S8E5NM",
  "D5M2Y9GP", "E3J4N8VK", "L2R1Z6BH", "W8C7B5QY", "Y1T3F9MD",
  "V5K2H7PX", "U0S6J8LG", "O9G4X3VR", "I3F5Q2CB", "T8D1P9NW",
  "R7Z0L6KY", "K4M8S2HJ", "A2V1C3TR", "P9E6N5QX", "Z0R3B4MW",
];

async function seedTokens() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/your-database-name");
    console.log("✅ Connected to MongoDB");

    // Clear existing tokens (optional - remove if you want to keep existing ones)
    const existingCount = await Token.countDocuments();
    console.log(`📊 Existing tokens: ${existingCount}`);
    
    // Check if tokens already exist
    if (existingCount > 0) {
      console.log("⚠️  Tokens already exist in database.");
      const answer = await askQuestion("Do you want to clear and reseed? (yes/no): ");
      
      if (answer.toLowerCase() === "yes") {
        await Token.deleteMany({});
        console.log("🗑️  Cleared existing tokens");
      } else {
        console.log("❌ Seeding cancelled");
        process.exit(0);
      }
    }

    // Insert tokens
    const tokenDocs = TOKENS.map((token) => ({
      token: token.toUpperCase(),
      isUsed: false,
      usedBy: null,
      usedAt: null,
    }));

    const result = await Token.insertMany(tokenDocs);
    console.log(`✅ Successfully seeded ${result.length} tokens`);

    // Display sample tokens
    console.log("\n📋 Sample tokens:");
    TOKENS.slice(0, 5).forEach((token, index) => {
      console.log(`   ${index + 1}. ${token}`);
    });
    console.log(`   ... and ${TOKENS.length - 5} more\n`);

    // Statistics
    const stats = {
      total: await Token.countDocuments(),
      unused: await Token.countDocuments({ isUsed: false }),
      used: await Token.countDocuments({ isUsed: true }),
    };

    console.log("📊 Token Statistics:");
    console.log(`   Total: ${stats.total}`);
    console.log(`   Available: ${stats.unused}`);
    console.log(`   Used: ${stats.used}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding tokens:", error);
    process.exit(1);
  }
}

// Helper function for user input (Node.js readline)
function askQuestion(query) {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    readline.question(query, (answer) => {
      readline.close();
      resolve(answer);
    })
  );
}

// Run the seeding
seedTokens();

// USAGE:
// 1. Save this file as scripts/seedTokens.js
// 2. Run: node scripts/seedTokens.js
// 3. Tokens will be added to your database