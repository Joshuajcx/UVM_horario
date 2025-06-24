const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sql = require('mssql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const app = express();
const port = 3000;
const recoveryData = {};

// Configuración de la base de datos utilizando el Factory Method
class DatabaseFactory {
    static createConnection() {
        const dbConfig = {
            user: 'sa',
            password: 'Joshuajcx200599',
            server: 'localhost',
            database: 'UVMH',
            options: {
                encrypt: false,
                trustServerCertificate: true
            }
        };
        return sql.connect(dbConfig);
    }
}

// Configuración del transporte de correo utilizando el Singleton
class MailerSingleton {
    static instance;

    static getInstance() {
        if (!MailerSingleton.instance) {
            MailerSingleton.instance = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'jcxsystems@gmail.com',
                    pass: 'eyxzkxpdcmfunllf',
                },
            });
        }
        return MailerSingleton.instance;
    }
}

// Observer para notificaciones de eventos
class Observer {
    constructor() {
        this.observers = [];
    }

    subscribe(observer) {
        this.observers.push(observer);
    }

    unsubscribe(observer) {
        this.observers = this.observers.filter(sub => sub !== observer);
    }

    notify(message) {
        this.observers.forEach(observer => observer.update(message));
    }
}

class MailerObserver {
    update(message) {
        const transporter = MailerSingleton.getInstance();
        transporter.sendMail({
            from: 'jcxsystems@gmail.com',
            to: message.email,
            subject: 'Notificación de Restablecimiento de Contraseña',
            text: message.text,
        });
    }
}


// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de la sesión
app.use(session({
    secret: 'secret_key',
    resave: false,
    saveUninitialized: true,
}));

app.get('/', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            res.redirect('/admin.html');
        } else {
            res.redirect('/horario.html');
        }
    } else {
        res.redirect('/login.html');
    }
});

// Ruta para el login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let pool = await DatabaseFactory.createConnection();
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM Usuarios WHERE username = @username');
        
        const user = result.recordset[0];
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = {
                username: user.username,
                role: user.rol
            };

            // Redirigir dependiendo del rol
            if (user.rol === 'admin') {
                res.json({ status: 'success', role: 'admin', redirect: '/admin.html' });
            } else {
                res.json({ status: 'success', role: 'user', redirect: '/horario.html' });
            }
        } else {
            res.status(401).json({ status: 'error', message: 'Credenciales incorrectas' });
        }
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al autenticar', error: err.message });
    }
});

// Ruta para cerrar sesión
app.get('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Error al cerrar sesión' });
        }
        res.json({ status: 'success', message: 'Sesión cerrada' });
    });
});

// Ruta para obtener una materia por ID
app.get('/api/materias/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let pool = await DatabaseFactory.createConnection();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM Materias WHERE id = @id');
        res.json(result.recordset[0]);
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al obtener materia', error: err.message });
    }
});

// Obtener todas las materias
app.get('/api/materias', async (req, res) => {
    try {
        let pool = await DatabaseFactory.createConnection();
        let result = await pool.request().query('SELECT * FROM Materias');
        res.json(result.recordset);
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al obtener materias', error: err.message });
    }
});

// Agregar una nueva materia
app.post('/api/materias', async (req, res) => {
    const { nombre, hora, dia, salon } = req.body;
    try {
        let pool = await DatabaseFactory.createConnection();
        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('hora', sql.VarChar, hora)
            .input('dia', sql.VarChar, dia)
            .input('salon', sql.VarChar, salon)
            .query('INSERT INTO Materias (nombre, hora, dia, salon) VALUES (@nombre, @hora, @dia, @salon)');
        res.json({ status: 'success', message: 'Materia agregada' });
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al agregar materia', error: err.message });
    }
});

// Ruta para agregar un nuevo usuario
app.post('/api/usuarios', async (req, res) => {
    const { nombre, matricula, username, password, rol, NSS, CURP, telefono } = req.body;

    if (!nombre || !matricula || !username || !password || !rol || !NSS || !CURP || !telefono) {
        return res.status(400).json({ status: 'error', message: 'Faltan datos requeridos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Hasheando la contraseña
        
        let pool = await DatabaseFactory.createConnection();
        await pool.request()
            .input('nombre', sql.NVarChar, nombre)
            .input('matricula', sql.NVarChar, matricula)
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .input('rol', sql.NVarChar, rol)
            .input('NSS', sql.NVarChar, NSS)
            .input('CURP', sql.NVarChar, CURP)
            .input('telefono', sql.NVarChar, telefono)
            .query('INSERT INTO Usuarios (nombre, matricula, username, password, rol, NSS, CURP, telefono) VALUES (@nombre, @matricula, @username, @password, @rol, @NSS, @CURP, @telefono)');

        res.status(200).json({ status: 'success', message: 'Usuario agregado' });
    } catch (error) {
        console.error('Error al agregar usuario:', error.message);
        res.status(500).json({ status: 'error', message: 'Error al agregar usuario', error: error.message });
    } finally {
        sql.close();
    }
});

// Ruta para obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
    try {
        let pool = await DatabaseFactory.createConnection();
        let result = await pool.request().query('SELECT * FROM Usuarios');
        res.json(result.recordset);
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al obtener usuarios', error: err.message });
    }
});

// Ruta para solicitar el código de recuperación
app.post('/api/recuperar', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ status: 'error', message: 'El correo es obligatorio.' });
    }

    try {
        // Conectarse a la base de datos para verificar si el username existe
        let pool = await DatabaseFactory.createConnection();
        const result = await pool.request()
            .input('username', sql.VarChar, email)
            .query('SELECT * FROM Usuarios WHERE username = @username');
        
        const user = result.recordset[0];
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Correo no encontrado.' });
        }

        // Generar un código aleatorio de recuperación
        const codigo = crypto.randomBytes(3).toString('hex');
        const expiracion = Date.now() + 3600000;

        // Guardar el código de recuperación en memoria temporal
        recoveryData[email] = { codigo, expiracion };

        // Enviar el código al correo electrónico
        const transporter = MailerSingleton.getInstance();
        await transporter.sendMail({
            from: 'jcxsystems@gmail.com',
            to: email,
            subject: 'Código de Recuperación de Contraseña',
            text: `Tu código de recuperación es: ${codigo}. Este código expirará en 1 hora.`,
        });

        res.json({ status: 'success', message: 'Se envió un código de verificación a tu correo.' });
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al enviar el código de recuperación', error: err.message });
    }
});


app.post('/api/restablecer', async (req, res) => {
    const { codigo, password } = req.body;

    if (!codigo || !password) {
        return res.status(400).json({ status: 'error', message: 'Todos los campos son obligatorios.' });
    }

    // Buscar el email que corresponde al código de recuperación
    const email = Object.keys(recoveryData).find(key => recoveryData[key].codigo === codigo);

    if (!email || recoveryData[email].expiracion < Date.now()) {
        return res.status(400).json({ status: 'error', message: 'Código inválido o expirado.' });
    }

    try {
        // Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Actualizar la contraseña en la base de datos
        let pool = await DatabaseFactory.createConnection();
        await pool.request()
            .input('username', sql.VarChar, email)
            .input('password', sql.VarChar, hashedPassword)
            .query('UPDATE Usuarios SET password = @password WHERE username = @username'); 

        // Eliminar el código de recuperación para mayor seguridad
        delete recoveryData[email]; 

        // Crear una instancia del Observer y notificar a los suscriptores (MailerObserver)
        const observer = new Observer();
        const mailerObserver = new MailerObserver();
        observer.subscribe(mailerObserver);

        // Notificar al observador (enviando un correo de confirmación)
        observer.notify({
            email: email,
            text: 'Tu contraseña ha sido restablecida exitosamente. Si no realizaste esta acción, contacta con el soporte.',
        });

        res.json({ status: 'success', message: 'Contraseña restablecida exitosamente.' });
        pool.close();
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Error al restablecer la contraseña', error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
