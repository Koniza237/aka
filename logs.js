
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Enable CORS for frontend requests
app.use(express.json()); // Parse JSON request bodies

// In-memory storage for logs and resources
let logs = [];
let teachers = [];
let rooms = [];
let groups = [];
let users = [];
let constraints = [];

// Helper function to add a log
const addLog = (user, action, details) => {
    const log = {
        id: Date.now().toString(), // Unique ID based on timestamp
        date: new Date().toISOString(), // ISO date string
        user: user || 'admin', // Default to 'admin' if no user provided
        action,
        details
    };
    logs.push(log);
    console.log('Log ajouté:', log); // Debug log
};

// GET /api/logs - Fetch all logs
app.get('/api/logs', (req, res) => {
    try {
        res.json(logs);
    } catch (error) {
        console.error('Erreur lors de la récupération des logs:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des logs' });
    }
});

// POST /api/resources/teachers - Add a teacher
app.post('/api/resources/teachers', (req, res) => {
    try {
        const teacher = { id: Date.now().toString(), ...req.body };
        teachers.push(teacher);
        addLog('admin', 'create_teacher', `Ajouté enseignant: ${teacher.name}`);
        res.json(teacher);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'enseignant:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de l\'enseignant' });
    }
});

// POST /api/resources/rooms - Add a room
app.post('/api/resources/rooms', (req, res) => {
    try {
        const room = { id: Date.now().toString(), ...req.body };
        rooms.push(room);
        addLog('admin', 'create_room', `Ajouté salle: ${room.name}`);
        res.json(room);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la salle:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de la salle' });
    }
});

// POST /api/resources/groups - Add a group
app.post('/api/resources/groups', (req, res) => {
    try {
        const group = { id: Date.now().toString(), ...req.body };
        groups.push(group);
        addLog('admin', 'create_group', `Ajouté groupe: ${group.name}`);
        res.json(group);
    } catch (error) {
        console.error('Erreur lors de l\'ajout du groupe:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout du groupe' });
    }
});

// GET /api/resources/teachers - Fetch teachers
app.get('/api/resources/teachers', (req, res) => {
    try {
        res.json(teachers);
    } catch (error) {
        console.error('Erreur lors de la récupération des enseignants:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des enseignants' });
    }
});

// GET /api/resources/rooms - Fetch rooms
app.get('/api/resources/rooms', (req, res) => {
    try {
        res.json(rooms);
    } catch (error) {
        console.error('Erreur lors de la récupération des salles:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des salles' });
    }
});

// GET /api/resources/groups - Fetch groups
app.get('/api/resources/groups', (req, res) => {
    try {
        res.json(groups);
    } catch (error) {
        console.error('Erreur lors de la récupération des groupes:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des groupes' });
    }
});

// POST /api/users/teachers - Add a teacher user
app.post('/api/users/teachers', (req, res) => {
    try {
        const user = { id: Date.now().toString(), type: 'teacher', ...req.body };
        users.push(user);
        addLog('admin', 'create_user', `Ajouté utilisateur: ${user.email}`);
        res.json(user);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'utilisateur enseignant:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de l\'utilisateur' });
    }
});

// POST /api/users/students - Add a student user
app.post('/api/users/students', (req, res) => {
    try {
        const user = { id: Date.now().toString(), type: 'student', ...req.body };
        users.push(user);
        addLog('admin', 'create_user', `Ajouté utilisateur: ${user.name}`);
        res.json(user);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'utilisateur étudiant:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de l\'utilisateur' });
    }
});

// POST /api/users/admins - Add an admin user
app.post('/api/users/admins', (req, res) => {
    try {
        const user = { id: Date.now().toString(), type: 'admin', ...req.body };
        users.push(user);
        addLog('admin', 'create_user', `Ajouté utilisateur: ${user.email}`);
        res.json(user);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'utilisateur admin:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de l\'utilisateur' });
    }
});

// GET /api/users/teachers - Fetch teacher users
app.get('/api/users/teachers', (req, res) => {
    try {
        res.json(users.filter(u => u.type === 'teacher'));
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs enseignants:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des utilisateurs' });
    }
});

// GET /api/users/students - Fetch student users
app.get('/api/users/students', (req, res) => {
    try {
        res.json(users.filter(u => u.type === 'student'));
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs étudiants:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des utilisateurs' });
    }
});

// GET /api/users/admins - Fetch admin users
app.get('/api/users/admins', (req, res) => {
    try {
        res.json(users.filter(u => u.type === 'admin'));
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs admins:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des utilisateurs' });
    }
});

// POST /api/constraints - Add a constraint
app.post('/api/constraints', (req, res) => {
    try {
        const constraint = { id: Date.now().toString(), ...req.body };
        constraints.push(constraint);
        addLog('admin', 'create_constraint', `Ajouté contrainte: ${constraint.resource} (${constraint.day}, ${constraint.time})`);
        res.json(constraint);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la contrainte:', error);
        res.status(500).json({ error: 'Erreur serveur lors de l\'ajout de la contrainte' });
    }
});

// GET /api/constraints - Fetch constraints
app.get('/api/constraints', (req, res) => {
    try {
        res.json(constraints);
    } catch (error) {
        console.error('Erreur lors de la récupération des contraintes:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des contraintes' });
    }
});

// POST /api/logout - Handle logout (stub)
app.post('/api/logout', (req, res) => {
    try {
        addLog('admin', 'logout', 'Déconnexion réussie');
        res.json({ message: 'Déconnexion réussie' });
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la déconnexion' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});
