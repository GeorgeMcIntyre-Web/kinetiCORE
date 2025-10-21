{
  "builds": [
    {
      "src": "package.json",
      "use": "@cloudflare/next-on-pages",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "functions": {
    "runtime": "nodejs18.x"
  }
}
