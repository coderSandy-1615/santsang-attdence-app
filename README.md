# Attendance Dashboard

A weekly attendance dashboard backed by MongoDB Atlas. Member records are stored in the `members` collection and attendance records in `attendances` in the configured database. The default database name is `satsang_attendance`.

## Important access notice

The dashboard API is intentionally unauthenticated. Anyone who can reach its URL can view member information and add, edit, or delete members and attendance. Deploy it publicly only if that is acceptable for your data.

## Run locally

1. Install Node.js 18 or later.
2. Set `MONGODB_URI` to your MongoDB Atlas connection string. Keep it private and do not commit it.
3. Optionally set `MONGODB_DB`; it defaults to `satsang_attendance`.
4. Install dependencies with `npm install` and start the server with `npm start`.
5. Open `http://localhost:3000`.

The MongoDB user needs read/write access to the configured database. The Node server runs locally, but all roster and attendance data is stored in MongoDB Atlas.

## Deploy to Render

The included `render.yaml` configures a Node web service. Create the service from the Blueprint and set `MONGODB_URI` in the Render service's Environment settings. `MONGODB_DB` defaults to `satsang_attendance`. Save and deploy.

Allow the Render service's outbound IP ranges in MongoDB Atlas under **Security > Network Access > IP Access List**. Do not use `0.0.0.0/0` for a production database. See [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses), [Render environment variables](https://render.com/docs/configure-environment-variables), and [MongoDB Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).
