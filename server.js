const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Définir les routes API avant les routes statiques
console.log('Initialisation des routes API...');

// Configuration de l'API Google GenAI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Fonction pour lire un fichier JSON
async function readJson(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        console.log(`Lecture réussie de ${file}`);
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`Fichier ${file} non trouvé, retour d'un tableau vide`);
            return [];
        }
        console.error(`Erreur lors de la lecture de ${file}:`, err.message);
        throw err;
    }
}

// Fonction pour écrire dans un fichier JSON
async function writeJson(file, data) {
    try {
        await fs.writeFile(file, JSON.stringify(data, null, 2));
        console.log(`Écriture réussie dans ${file}`);
    } catch (err) {
        console.error(`Erreur lors de l'écriture dans ${file}:`, err.message);
        throw err;
    }
}

// Mappage des types de ressources et utilisateurs
const fileMap = {
    teachers: 'ress-ens.json',
    groups: 'ress-group.json',
    rooms: 'ress-salle.json',
    admins: 'admin.json',
    students: 'students.json',
    documents: 'documents.json'
};

// Créer les dossiers nécessaires
const emploitDir = path.join(__dirname, 'emploit');
fs.mkdir(emploitDir, { recursive: true }).catch(err => console.error('Erreur lors de la création du dossier emploit:', err));

const uploadsDir = path.join(__dirname, 'Uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(err => console.error('Erreur lors de la création du dossier uploads:', err));

// Configuration de multer pour l'upload des fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Endpoint pour l'IA
app.post('/api/ai', async (req, res) => {
    console.log('Requête POST /api/ai reçue', req.body);
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt requis' });
        }
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        res.json({ response });
    } catch (err) {
        console.error('Erreur lors de l\'appel à l\'API Google GenAI:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la génération de la réponse' });
    }
});

// Endpoint pour la connexion des administrateurs
app.post('/api/login', async (req, res) => {
    console.log('Requête POST /api/login reçue:', req.body);
    const { email, password } = req.body;
    if (!email || !password) {
        console.error('Requête de connexion invalide: email ou mot de passe manquant');
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    try {
        const admins = await readJson(fileMap.admins);
        const admin = admins.find(a => a.email === email && a.password === password);
        if (!admin) {
            console.warn(`Échec de connexion: identifiants incorrects pour ${email}`);
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }
        console.log(`Connexion réussie pour ${email}`);
        res.json({ message: 'Connexion réussie', admin: { id: admin.id, email: admin.email, role: 'Administrateur' } });
    } catch (err) {
        console.error('Erreur lors de la connexion:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
    }
});

// Endpoint pour la déconnexion
app.post('/api/logout', async (req, res) => {
    console.log('Requête POST /api/logout reçue');
    try {
        const files = await fs.readdir(emploitDir);
        for (const file of files) {
            await fs.unlink(path.join(emploitDir, file));
        }
        console.log('Déconnexion réussie, dossier emploit vidé');
        res.json({ message: 'Déconnexion réussie' });
    } catch (err) {
        console.error('Erreur lors de la déconnexion:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la déconnexion' });
    }
});

// Endpoints pour la gestion des ressources
app.get('/api/resources/:type', async (req, res) => {
    console.log(`Requête GET /api/resources/${req.params.type} reçue`);
    const type = req.params.type;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await readJson(fileMap[type]);
        res.json(data);
    } catch (err) {
        console.error(`Erreur lors de la lecture de ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/resources/:type', async (req, res) => {
    console.log(`Requête POST /api/resources/${req.params.type} reçue`, req.body);
    const type = req.params.type;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await readJson(fileMap[type]);
        const newResource = { id: data.length ? Math.max(...data.map(r => r.id)) + 1 : 1, ...req.body };
        data.push(newResource);
        await writeJson(fileMap[type], data);
        res.json(newResource);
    } catch (err) {
        console.error(`Erreur lors de l'écriture dans ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/resources/:type/:id', async (req, res) => {
    console.log(`Requête PUT /api/resources/${req.params.type}/${req.params.id} reçue`, req.body);
    const { type, id } = req.params;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await readJson(fileMap[type]);
        const index = data.findIndex(r => r.id === parseInt(id));
        if (index === -1) return res.status(404).json({ error: 'Ressource non trouvée' });
        data[index] = { ...data[index], ...req.body };
        await writeJson(fileMap[type], data);
        res.json(data[index]);
    } catch (err) {
        console.error(`Erreur lors de la mise à jour de ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/resources/:type/:id', async (req, res) => {
    console.log(`Requête DELETE /api/resources/${req.params.type}/${req.params.id} reçue`);
    const { type, id } = req.params;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        let data = await readJson(fileMap[type]);
        const index = data.findIndex(r => r.id === parseInt(id));
        if (index === -1) return res.status(404).json({ error: 'Ressource non trouvée' });
        data = data.filter(r => r.id !== parseInt(id));
        await writeJson(fileMap[type], data);
        res.json({ message: 'Ressource supprimée' });
    } catch (err) {
        console.error(`Erreur lors de la suppression dans ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoints pour la gestion des utilisateurs
app.get('/api/users/:type', async (req, res) => {
    console.log(`Requête GET /api/users/${req.params.type} reçue`);
    const type = req.params.type;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await readJson(fileMap[type]);
        if (type === 'students') {
            return res.json(data.map((u, index) => ({ ...u, id: u.id || index + 1 })));
        }
        res.json(data);
    } catch (err) {
        console.error(`Erreur lors de la lecture de ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/users/:type', async (req, res) => {
    console.log(`Requête POST /api/users/${req.params.type} reçue`, req.body);
    const type = req.params.type;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await readJson(fileMap[type]);
        const newUser = { id: data.length ? Math.max(...data.map(u => u.id || 0)) + 1 : 1, ...req.body };
        data.push(newUser);
        await writeJson(fileMap[type], data);
        res.json(newUser);
    } catch (err) {
        console.error(`Erreur lors de l'écriture dans ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/users/:type/:id', async (req, res) => {
    console.log(`Requête PUT /api/users/${req.params.type}/${req.params.id} reçue`, req.body);
    const { type, id } = req.params;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        const data = await readJson(fileMap[type]);
        const index = data.findIndex(u => (u.id || u.username) === (type === 'students' ? id : parseInt(id)));
        if (index === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        data[index] = { ...data[index], ...req.body };
        await writeJson(fileMap[type], data);
        res.json(data[index]);
    } catch (err) {
        console.error(`Erreur lors de la mise à jour de ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/users/:type/:id', async (req, res) => {
    console.log(`Requête DELETE /api/users/${req.params.type}/${req.params.id} reçue`);
    const { type, id } = req.params;
    if (!fileMap[type]) return res.status(400).json({ error: 'Type invalide' });
    try {
        let data = await readJson(fileMap[type]);
        const index = data.findIndex(u => (u.id || u.username) === (type === 'students' ? id : parseInt(id)));
        if (index === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        data = data.filter((_, i) => i !== index);
        await writeJson(fileMap[type], data);
        res.json({ message: 'Utilisateur supprimé' });
    } catch (err) {
        console.error(`Erreur lors de la suppression dans ${fileMap[type]}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoints pour les contraintes
app.get('/api/constraints', async (req, res) => {
    console.log('Requête GET /api/constraints reçue');
    try {
        const data = await readJson('constraints.json');
        res.json(data);
    } catch (err) {
        console.error('Erreur lors de la lecture de constraints.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/constraints', async (req, res) => {
    console.log('Requête POST /api/constraints reçue', req.body);
    try {
        const data = await readJson('constraints.json');
        const newConstraint = { id: data.length ? Math.max(...data.map(c => c.id)) + 1 : 1, ...req.body };
        data.push(newConstraint);
        await writeJson('constraints.json', data);
        res.json(newConstraint);
    } catch (err) {
        console.error('Erreur lors de l\'écriture dans constraints.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.put('/api/constraints/:id', async (req, res) => {
    console.log(`Requête PUT /api/constraints/${req.params.id} reçue`, req.body);
    const { id } = req.params;
    try {
        const data = await readJson('constraints.json');
        const index = data.findIndex(c => c.id === parseInt(id));
        if (index === -1) return res.status(404).json({ error: 'Contrainte non trouvée' });
        data[index] = { ...data[index], ...req.body };
        await writeJson('constraints.json', data);
        res.json(data[index]);
    } catch (err) {
        console.error('Erreur lors de la modification de constraints.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/constraints/:id', async (req, res) => {
    console.log(`Requête DELETE /api/constraints/${req.params.id} reçue`);
    const id = req.params.id;
    try {
        let data = await readJson('constraints.json');
        const index = data.findIndex(c => c.id === parseInt(id));
        if (index === -1) return res.status(404).json({ error: 'Contrainte non trouvée' });
        data = data.filter(c => c.id !== parseInt(id));
        await writeJson('constraints.json', data);
        res.json({ message: 'Contrainte supprimée' });
    } catch (err) {
        console.error('Erreur lors de la suppression dans constraints.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoints pour la gestion des documents
app.get('/api/documents', async (req, res) => {
    console.log('Requête GET /api/documents reçue');
    try {
        const data = await readJson(fileMap.documents);
        res.json(data);
    } catch (err) {
        console.error('Erreur lors de la lecture de documents.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/documents', upload.single('file'), async (req, res) => {
    console.log('Requête POST /api/documents reçue', req.body);
    try {
        const { title, category, uploadedBy } = req.body;
        if (!title || !category || !req.file) {
            return res.status(400).json({ error: 'Titre, catégorie et fichier requis' });
        }
        const data = await readJson(fileMap.documents);
        const newDocument = {
            id: data.length ? Math.max(...data.map(d => d.id)) + 1 : 1,
            title,
            category,
            fileName: req.file.filename,
            uploadedBy: uploadedBy || 'Admin',
            uploadDate: new Date().toISOString().slice(0, 16).replace('T', ' ')
        };
        data.push(newDocument);
        await writeJson(fileMap.documents, data);
        res.json(newDocument);
    } catch (err) {
        console.error('Erreur lors de l\'enregistrement du document:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/documents/:id/download', async (req, res) => {
    console.log(`Requête GET /api/documents/${req.params.id}/download reçue`);
    const { id } = req.params;
    try {
        const data = await readJson(fileMap.documents);
        const document = data.find(d => d.id === parseInt(id));
        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }
        const filePath = path.join(uploadsDir, document.fileName);
        res.download(filePath, document.fileName, (err) => {
            if (err) {
                console.error('Erreur lors du téléchargement du fichier:', err.message);
                res.status(500).json({ error: 'Erreur serveur lors du téléchargement' });
            }
        });
    } catch (err) {
        console.error('Erreur lors de la lecture de documents.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/documents/:id', async (req, res) => {
    console.log(`Requête DELETE /api/documents/${req.params.id} reçue`);
    const { id } = req.params;
    try {
        let data = await readJson(fileMap.documents);
        const document = data.find(d => d.id === parseInt(id));
        if (!document) {
            return res.status(404).json({ error: 'Document non trouvé' });
        }
        const filePath = path.join(UploadsDir, document.fileName);
        await fs.unlink(filePath).catch(err => {
            console.error('Erreur lors de la suppression du fichier:', err.message);
        });
        data = data.filter(d => d.id !== parseInt(id));
        await writeJson(fileMap.documents, data);
        res.json({ message: 'Document supprimé' });
    } catch (err) {
        console.error('Erreur lors de la suppression du document:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoints pour la gestion des messages
app.get('/api/messages', async (req, res) => {
    console.log('Requête GET /api/messages reçue');
    try {
        const messagesEtu = await readJson('messages-etu.json');
        const formattedMessages = messagesEtu.map(msg => ({
            content: msg.content || msg,
            type: 'students',
            timestamp: msg.timestamp || new Date().toISOString()
        }));
        console.log('Messages envoyés au client:', formattedMessages);
        res.json(formattedMessages);
    } catch (err) {
        console.error('Erreur lors de la lecture des messages:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors du chargement des messages' });
    }
});

app.post('/api/messages-etu', async (req, res) => {
    console.log('Requête POST /api/messages-etu reçue:', req.body);
    try {
        const { content } = req.body;
        const messages = await readJson('messages-etu.json');
        messages.push({ content, timestamp: new Date().toISOString() });
        await writeJson('messages-etu.json', messages);
        console.log('Nouveau message étudiant enregistré:', content);
        res.json({ content, type: 'students', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Erreur lors de l\'écriture dans messages-etu.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de l\'envoi du message' });
    }
});

app.post('/api/messages-ens', async (req, res) => {
    console.log('Requête POST /api/messages-ens reçue:', req.body);
    try {
        const { content } = req.body;
        const messages = await readJson('messages-ens.json');
        messages.push({ content, timestamp: new Date().toISOString() });
        await writeJson('messages-ens.json', messages);
        console.log('Nouveau message enseignant enregistré:', content);
        res.json({ content, type: 'teachers', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Erreur lors de l\'écriture dans messages-ens.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors de l\'envoi du message' });
    }
});

app.get('/api/messages-ens', async (req, res) => {
    console.log('Requête GET /api/messages-ens reçue');
    try {
        const messages = await readJson('messages-ens.json');
        const formattedMessages = messages.map((msg, index) => ({
            ...msg,
            id: index,
            timestamp: msg.timestamp || new Date().toISOString(),
            type: 'teachers'
        }));
        res.json(formattedMessages);
    } catch (err) {
        console.error('Erreur lors de la lecture de messages-ens.json:', err.message);
        res.status(500).json({ error: 'Erreur serveur lors du chargement des messages' });
    }
});

app.delete('/api/messages/:type/:index', async (req, res) => {
    console.log(`Requête DELETE /api/messages/${req.params.type}/${req.params.index} reçue`);
    const { type, index } = req.params;
    const file = type === 'students' ? 'messages-etu.json' : 'messages-ens.json';
    if (type !== 'students' && type !== 'teachers') {
        return res.status(400).json({ error: 'Type invalide' });
    }
    try {
        const messages = await readJson(file);
        const idx = parseInt(index);
        if (idx < 0 || idx >= messages.length) {
            return res.status(404).json({ error: 'Message non trouvé' });
        }
        messages.splice(idx, 1);
        await writeJson(file, messages);
        console.log(`Message à l'index ${idx} supprimé dans ${file}`);
        res.json({ message: 'Message supprimé' });
    } catch (err) {
        console.error(`Erreur lors de la suppression dans ${file}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression du message' });
    }
});

// Endpoints pour la visualisation
app.get('/api/visualisation', async (req, res) => {
    console.log('Requête GET /api/visualisation reçue');
    try {
        const files = await fs.readdir(emploitDir);
        const visualisationData = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const data = await readJson(path.join(emploitDir, file));
                visualisationData.push(data);
            }
        }
        res.json(visualisationData);
    } catch (err) {
        console.error('Erreur lors de la lecture du dossier emploit:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.delete('/api/visualisation', async (req, res) => {
    console.log('Requête DELETE /api/visualisation reçue');
    try {
        const files = await fs.readdir(emploitDir);
        for (const file of files) {
            await fs.unlink(path.join(emploitDir, file));
        }
        res.json({ message: 'Dossier emploit vidé' });
    } catch (err) {
        console.error('Erreur lors de la suppression du dossier emploit:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoint pour l'historique
app.get('/api/history', async (req, res) => {
    console.log('Requête GET /api/history reçue');
    try {
        const files = await fs.readdir(emploitDir);
        const historyData = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const match = file.match(/timetable_(\d{4}-\d{2}-\d{2})/);
                return {
                    name: file,
                    date: match ? match[1] : 'Inconnu'
                };
            });
        res.json(historyData);
    } catch (err) {
        console.error('Erreur lors de la lecture du dossier emploit:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoint pour récupérer un fichier spécifique
app.get('/api/timetable/:fileName', async (req, res) => {
    console.log(`Requête GET /api/timetable/${req.params.fileName} reçue`);
    const { fileName } = req.params;
    try {
        const data = await readJson(path.join(emploitDir, fileName));
        res.json(data);
    } catch (err) {
        console.error(`Erreur lors de la lecture du fichier ${fileName}:`, err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Endpoint pour l'exportation
app.post('/api/export-timetable', async (req, res) => {
    console.log('Requête POST /api/export-timetable reçue', req.body);
    const { timetables, date } = req.body;
    if (!timetables || !date) {
        return res.status(400).json({ error: 'Données ou date manquantes' });
    }
    try {
        const fileName = `timetable_${date}.json`;
        const timetableData = { date, timetable: timetables };
        await writeJson(path.join(emploitDir, fileName), timetableData);
        res.json({ message: 'Emploi du temps exporté avec succès' });
    } catch (err) {
        console.error('Erreur lors de l\'exportation:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Génération automatique d'emploi du temps
app.post('/api/generate-timetable', async (req, res) => {
    console.log('Requête POST /api/generate-timetable reçue', req.body);
    const { date } = req.body;
    if (!date) {
        return res.status(400).json({ error: 'Date requise' });
    }
    try {
        const teachers = await readJson(fileMap.teachers);
        const groups = await readJson(fileMap.groups);
        const rooms = await readJson(fileMap.rooms);
        const constraints = await readJson('constraints.json');

        if (!teachers.length || !groups.length || !rooms.length || !constraints.length) {
            return res.status(400).json({ error: 'Données insuffisantes pour générer un emploi du temps' });
        }

        const timetable = [];
        const timeSlots = ['08:00-10:00', '10:00-12:00', '13:00-15:00', '15:00-17:00'];
        const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

        for (const slot of timeSlots) {
            const entry = { time: slot };
            for (const day of days) {
                const availableTeachers = teachers.filter(t => {
                    return !constraints.some(c => 
                        c.resource === t.name && 
                        c.day.toLowerCase() === day && 
                        c.time === slot && 
                        c.type === 'Indisponible'
                    );
                });
                const availableGroups = groups.filter(g => {
                    return !constraints.some(c => 
                        c.resource === g.name && 
                        c.day.toLowerCase() === day && 
                        c.time === slot && 
                        c.type === 'Indisponible'
                    );
                });
                const availableRooms = rooms.filter(r => {
                    return !constraints.some(c => 
                        c.resource === r.name && 
                        c.day.toLowerCase() === day && 
                        c.time === slot && 
                        c.type === 'Indisponible'
                    );
                });

                if (availableTeachers.length && availableGroups.length && availableRooms.length) {
                    const teacher = availableTeachers[Math.floor(Math.random() * availableTeachers.length)];
                    const group = availableGroups[Math.floor(Math.random() * availableGroups.length)];
                    const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
                    const subject = teacher.subjects ? teacher.subjects.split(', ')[0] : 'Matière';
                    entry[day] = `${subject} (${teacher.name}, ${group.name}, ${room.name})`;
                } else {
                    entry[day] = '-';
                }
            }
            timetable.push(entry);
        }

        const fileName = `timetable_${date}.json`;
        const timetableData = { date, timetable };
        await writeJson(path.join(emploitDir, fileName), timetableData);
        res.json(timetableData);
    } catch (err) {
        console.error('Erreur lors de la génération de l\'emploi du temps:', err.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Servir les fichiers statiques directement depuis la racine
app.use(express.static(__dirname));
console.log('Routes statiques configurées pour:', __dirname);

// Route spécifique pour aideetu.html
app.get('/aideetu.html', (req, res) => {
    console.log('Requête GET /aideetu.html reçue');
    const filePath = path.join(__dirname, 'aideetu.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Erreur lors du chargement de aideetu.html:', err.message);
            res.status(404).json({ error: 'Page aideetu.html non trouvée' });
        } else {
            console.log('aideetu.html servi avec succès');
        }
    });
});

// Middleware pour capturer les routes non trouvées
app.use((req, res, next) => {
    console.log(`Route non trouvée: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route non trouvée' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));