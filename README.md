This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Configuration

This application supports persistent server-side configuration for Proxmox credentials.

1.  Copy `proxmox-config.json.sample` to `proxmox-config.json`.
2.  Edit `proxmox-config.json` with your Proxmox API and SSH details.

```json
{
  "host": "https://<your-proxmox-ip>:8006",
  "node": "pve",
  "token": "root@pam!tokenid=...",
  "sshHost": "<your-proxmox-ip>",
  "sshUsername": "root",
  "sshPassword": "<your-password>"
}
```


## Docker Deployment

You can deploy this application using Docker.

### 1. Build and Run Container

```bash
# Build the image
docker build -t proxmox-ctrl .

# Run the container
# Mount your config file to /app/proxmox-config.json
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/proxmox-config.json:/app/proxmox-config.json \
  --name proxmox-ctrl \
  proxmox-ctrl
```

### 2. Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./proxmox-config.json:/app/proxmox-config.json
    restart: always
```

Then run:

```bash
docker-compose up -d
```

