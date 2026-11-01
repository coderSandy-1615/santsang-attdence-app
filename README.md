# Attendance Dashboard

A weekly attendance dashboard backed by MongoDB. Data is stored in the `dashboard_state` collection in a single `SK2042` document. Existing browser-local roster and attendance data is migrated to MongoDB the first time the app connects to an empty database.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB Atlas connection string. Replace the sample credentials and cluster host; do not commit the real URI.
3. Set `APP_PASSWORD` to a private password of at least 16 characters. The dashboard asks for this password in the browser; it is held in the current tab's session storage.
4. Install dependencies with `npm install`.
5. In PowerShell, set the environment variables and start the server:

   ```powershell
   $env:MONGODB_URI = "mongodb+srv://..."
   $env:MONGODB_DB = "attendance_dashboard"
   $env:APP_PASSWORD = "use-a-long-private-password"
   npm start
   ```

6. Open `http://localhost:3000`.

The MongoDB user needs read/write access to the configured database. The API rejects requests without the dashboard password. Use HTTPS for any deployed instance and keep the MongoDB URI and password private.

## Deploy to Render

The included `render.yaml` creates a Node web service. Create the service from the Blueprint, then:

1. In the Render service, open **Connect > Outbound** and copy all outbound IP ranges for the service's region.
2. In MongoDB Atlas, add those ranges under **Security > Network Access > IP Access List**. Do not use `0.0.0.0/0` for a production database.
3. In the Render service's **Environment**, set `MONGODB_URI` to the Atlas connection string and `APP_PASSWORD` to a private password of at least 16 characters. `MONGODB_DB` defaults to `attendance_dashboard`.
4. Save and deploy. The Atlas database user in the URI needs read/write access to the configured database.

Render's outbound ranges can change with the service region. See [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses), [Render environment variables](https://render.com/docs/configure-environment-variables), and [MongoDB Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).
