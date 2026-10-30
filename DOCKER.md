# Run Farmer Advisory with Docker

## Requirements

- Docker Desktop installed and running (with Linux containers enabled)
- A Supabase project, if you want Supabase chat features to work

## Configure the app

The project uses these Vite build variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Copy `.env.example` to `.env` and fill in the values from your Supabase project. The `.env` file is excluded from Git and Docker build context. Docker Compose reads it to provide the public Vite values during the image build. Vite places these values in browser JavaScript, so do not put private service-role keys or other secrets in them.

If you leave the values blank, the page can still build, but Supabase-backed features will not work.

## Build and start

Open this folder in VS Code, open **Terminal → New Terminal**, and run:

```powershell
docker compose up --build -d
```

This builds and saves the local image as `farmeradvisory:latest`, then starts the container. Open [http://localhost:8080](http://localhost:8080).

Useful commands:

```powershell
docker compose ps
docker compose logs -f
docker compose down
docker image ls farmeradvisory
```

To export the image to a tar archive for moving to another machine:

```powershell
docker save -o farmeradvisory-image.tar farmeradvisory:latest
```

On the other machine, load it with `docker load -i farmeradvisory-image.tar`.

## Run without Docker

With Node.js 20 or newer installed:

```powershell
npm ci
npm run dev
```

Then open the local URL printed by Vite (normally `http://localhost:8080`).
