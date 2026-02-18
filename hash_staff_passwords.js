// Script to hash all plain text passwords in StaffLog collection
// Run this ONCE after updating your server to use bcrypt everywhere

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Update with your actual MongoDB connection string
const MONGO_URI = 'mongodb+srv://dasun:dasun1234@cluster0.kyxbb5f.mongodb.net/logDB';

const staffLogSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  password: String,
  createdAt: { type: Date, default: Date.now }
});
const StaffLog = mongoose.model('StaffLog', staffLogSchema, 'stafflog');

async function hashPlainPasswords() {
  await mongoose.connect(MONGO_URI);
  const users = await StaffLog.find();
  for (const user of users) {
    // If password is already hashed (starts with $2b$), skip
    if (user.password && user.password.startsWith('$2b$')) continue;
    // Otherwise, hash the plain text password
    if (user.password) {
      const hashed = await bcrypt.hash(user.password, 10);
      user.password = hashed;
      await user.save();
      console.log(`Updated password for: ${user.email}`);
    }
  }
  await mongoose.disconnect();
  console.log('All plain text passwords have been hashed.');
}

hashPlainPasswords().catch(console.error);
