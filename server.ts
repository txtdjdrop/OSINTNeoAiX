import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import archiver from "archiver";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // In-Memory Data Store (Starts Empty)
  let investigations: any[] = [];
  let activities: any[] = [];
  let entities: any[] = [];
  let relationships: any[] = [];
  let comments: Record<string, any[]> = {}; // investigationId -> comments
  let uploads: Record<string, any[]> = {}; // investigationId -> uploads

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/investigations", (req, res) => {
    res.json(investigations);
  });

  app.post("/api/investigations", (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const newInv = {
      id: Math.random().toString(36).substring(7),
      name,
      description: description || "",
      entities: 0,
      status: 'Active Analysis',
      updated: 'Just now'
    };
    
    investigations.unshift(newInv);
    comments[newInv.id] = [];
    uploads[newInv.id] = [];
    
    activities.unshift({
      action: 'Investigation Created',
      target: name,
      type: 'investigation',
      time: 'Just now',
      status: 'active'
    });

    res.json(newInv);
  });

  app.get("/api/investigations/:id/comments", (req, res) => {
    const { id } = req.params;
    res.json(comments[id] || []);
  });

  app.post("/api/investigations/:id/comments", (req, res) => {
    const { id } = req.params;
    const { author, text } = req.body;
    
    if (!comments[id]) comments[id] = [];
    
    const newComment = {
      id: Math.random().toString(36).substring(7),
      author: author || 'Anonymous',
      text,
      timestamp: 'Just now',
      status: 'Pending Review',
      entities: []
    };
    
    comments[id].unshift(newComment);
    
    activities.unshift({
      action: 'Comment Added',
      target: text.substring(0, 20) + '...',
      type: 'comment',
      time: 'Just now',
      status: 'active'
    });

    res.json(newComment);
  });

  app.get("/api/investigations/:id/uploads", (req, res) => {
    const { id } = req.params;
    res.json(uploads[id] || []);
  });

  app.post("/api/investigations/:id/uploads", (req, res) => {
    const { id } = req.params;
    const { name, size, uploader } = req.body;
    
    if (!uploads[id]) uploads[id] = [];
    
    const newUpload = {
      id: Math.random().toString(36).substring(7),
      name,
      size,
      uploader: uploader || 'Anonymous',
      status: 'pending',
      date: 'Just now'
    };
    
    uploads[id].unshift(newUpload);
    
    activities.unshift({
      action: 'Evidence Uploaded',
      target: name,
      type: 'upload',
      time: 'Just now',
      status: 'active'
    });

    res.json(newUpload);
  });

  app.get("/api/activities", (req, res) => {
    res.json(activities);
  });

  app.get("/api/stats", (req, res) => {
    res.json({
      activeInvestigations: investigations.length,
      totalEntities: entities.length,
      provenLinks: relationships.length,
      pendingEvidence: 0
    });
  });

  app.get("/api/graph/entity/:id", (req, res) => {
    res.json({
      nodes: [
        { id: '1', name: 'Andrew Hoang Do', type: 'person' },
        { id: '2', name: 'Viet America Society', type: 'organization' },
        { id: '3', name: 'Hand to Hand Relief', type: 'organization' },
        { id: '4', name: 'Bridget', type: 'person' },
        { id: '5', name: 'Kevin Elliot', type: 'person' },
        { id: '6', name: 'Mercy House', type: 'organization' },
        { id: '7', name: 'St. Andrew St', type: 'location' },
        { id: '8', name: 'Prince St', type: 'location' },
        { id: '9', name: 'Pacific Air Show', type: 'event' }
      ],
      links: [
        { source: '1', target: '2', type: 'directs' },
        { source: '1', target: '3', type: 'directs' },
        { source: '4', target: '5', type: 'knows' },
        { source: '4', target: '6', type: 'associated_with' },
        { source: '4', target: '7', type: 'lives_near' },
        { source: '4', target: '8', type: 'lives_near' },
        { source: '4', target: '9', type: 'attended' },
        { source: '5', target: '9', type: 'associated_with' }
      ]
    });
  });

  app.post("/api/investigations/:id/notes", (req, res) => {
    const { id } = req.params;
    const { content, author } = req.body;
    
    // In a real app, this would save to Firestore
    res.json({ success: true, note: { content, author, createdAt: new Date().toISOString() } });
  });

  app.post("/api/search", async (req, res) => {
    const { query } = req.body;
    // Perform search using Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    res.json({ result: response.text });
  });

  // Download Source Code Route
  app.get('/api/download-zip', (req, res) => {
    res.attachment('OSINTNeoAiX-source.zip');
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', function(err) {
      res.status(500).send({error: err.message});
    });

    archive.pipe(res);

    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: ['node_modules/**', 'dist/**', '.git/**']
    });

    archive.finalize();
  });

  // GitHub Sync Route
  app.post('/api/sync-github', async (req, res) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(400).json({ error: 'GITHUB_TOKEN not configured in environment variables.' });
    }

    try {
      // Configure git
      await execAsync('git config --global user.name "AI Studio Auto-Sync"');
      await execAsync('git config --global user.email "auto-sync@aistudio.local"');

      // Initialize if needed
      await execAsync('rm -rf .git');
      await execAsync('git init');

      // Set remote with token
      const repoUrl = `https://oauth2:${token}@github.com/txtdjdrop/OSINTNeoAiX.git`;
      await execAsync(`git remote remove origin`).catch(() => {});
      await execAsync(`git remote add origin ${repoUrl}`);

      // Add and commit
      await execAsync('git reset').catch(() => {});
      try {
        await execAsync('git add -A');
      } catch (err) {
        console.error('Git add failed:', err);
        throw err;
      }
      
      try {
        await execAsync('git commit -m "Auto-sync update from AI Studio"');
      } catch (e: any) {
        // If there's nothing to commit, that's fine
        if (!e.stdout?.includes('nothing to commit') && !e.message?.includes('nothing to commit')) {
          throw e;
        }
      }

      // Ensure we are on main branch
      await execAsync('git branch -M main');
      
      // Push to GitHub
      await execAsync('git push -u origin main --force');

      res.json({ success: true, message: 'Successfully synced to GitHub!' });
    } catch (error: any) {
      console.error('Git sync error:', error);
      res.status(500).json({ 
        error: 'Failed to sync with GitHub', 
        details: error.message || String(error)
      });
    }
  });

  // GitHub OAuth Routes
  app.get('/api/auth/url', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'CLIENT_ID not configured' });
    }
    const redirectUri = req.query.redirect_uri as string;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user',
    });
    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).send('OAuth credentials not configured on server.');
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.access_token) {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });
        const userData = await userRes.json();

        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(userData)} }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. This window should close automatically.</p>
            </body>
          </html>
        `);
      } else {
        res.send('Authentication failed.');
      }
    } catch (error) {
      res.send('An error occurred during authentication.');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
