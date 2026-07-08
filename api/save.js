module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { password, data } = req.body || {};

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Contraseña incorrecta' });
    return;
  }

  if (!data || !data.hero || !Array.isArray(data.links)) {
    res.status(400).json({ error: 'Datos incompletos' });
    return;
  }

  const token = process.env.GH_TOKEN;
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  const path = 'data/links.json';

  if (!token || !repo) {
    res.status(500).json({ error: 'Falta configuración del servidor (GH_TOKEN / GH_REPO)' });
    return;
  }

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'summit-links-admin',
  };

  try {
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers: ghHeaders });
    if (!getRes.ok) {
      res.status(502).json({ error: 'No se pudo leer el archivo actual en GitHub' });
      return;
    }
    const current = await getRes.json();

    const content = Buffer.from(JSON.stringify(data, null, 2), 'utf-8').toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Actualizar enlaces desde el panel de administración',
        content,
        sha: current.sha,
        branch,
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.json().catch(() => ({}));
      res.status(502).json({ error: errBody.message || 'No se pudo guardar en GitHub' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error inesperado del servidor' });
  }
};
