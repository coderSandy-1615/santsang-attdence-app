require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const { maleRoster, femaleRoster } = require('./roster');

const { MONGODB_URI, MONGODB_DB = 'satsang_attendance' } = process.env;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI must be configured.');
}

const client = new MongoClient(MONGODB_URI);
const app = express();
const port = process.env.PORT || 3000;
const initialRoster = [
  ...maleRoster.map(member => ({ ...member, category: 'पुरुष' })),
  ...femaleRoster.map(member => ({ ...member, category: 'महिला' }))
];

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/api/data', async (req, res, next) => {
  try {
    const db = client.db(MONGODB_DB);
    const membersCollection = db.collection('members');
    const attendanceCollection = db.collection('attendances');
    const legacyState = await db.collection('dashboard_state').findOne({ _id: 'SK2042' });
    const attendanceState = await attendanceCollection.findOne({ _id: 'SK2042' });
    let roster = await membersCollection
      .find({ appId: 'SK2042' }, { projection: { _id: 0, appId: 0 } })
      .toArray();

    if (roster.length === 0 && Array.isArray(legacyState?.roster) && legacyState.roster.length > 0) {
      const { roster: legacyRoster } = legacyState;
      await membersCollection.insertMany(legacyRoster.map(({ _id, ...member }) => ({
        ...member,
        appId: 'SK2042'
      })));
      roster = legacyRoster;
    }

    const rosterInitialized = roster.length > 0
      || attendanceState?.rosterInitialized
      || Array.isArray(legacyState?.roster);
    res.json({
      roster: rosterInitialized ? roster : null,
      attendance: attendanceState?.attendance ?? legacyState?.attendance ?? null,
      initialRoster
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/data', async (req, res, next) => {
  const { roster, attendance } = req.body || {};
  if (
    !Array.isArray(roster)
    || roster.some(member => !member || typeof member.id !== 'string' || !member.id)
    || new Set(roster.map(member => member.id)).size !== roster.length
    || !attendance
    || typeof attendance !== 'object'
    || Array.isArray(attendance)
  ) {
    return res.status(400).json({ error: 'Expected a roster array and attendance object.' });
  }

  try {
    const db = client.db(MONGODB_DB);
    const membersCollection = db.collection('members');
    const memberIds = roster.map(member => member.id);

    if (roster.length > 0) {
      await membersCollection.bulkWrite(roster.map(({ _id, ...member }) => ({
        updateOne: {
          filter: { appId: 'SK2042', id: member.id },
          update: { $set: { ...member, appId: 'SK2042' } },
          upsert: true
        }
      })));
    }
    await membersCollection.deleteMany({
      appId: 'SK2042',
      id: { $nin: memberIds }
    });
    await db.collection('attendances').replaceOne(
      { _id: 'SK2042' },
      { _id: 'SK2042', attendance, rosterInitialized: true, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
});

app.get('/roster.js', (req, res) => res.sendStatus(404));
app.use(express.static(__dirname));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'The server could not complete the request.' });
});

async function start() {
  await client.connect();
  app.listen(port, () => console.log(`Attendance dashboard listening on port ${port}`));
}

start().catch(error => {
  console.error('Unable to connect to MongoDB or start the server:', error);
  process.exitCode = 1;
});
