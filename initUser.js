const bcrypt = require('bcrypt');
const sql = require('mssql');

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

async function hashPassword() {
    const username = 'rubi@gmail.com';  // Cambia el nombre de usuario según sea necesario
    const plainPassword = '200599'; // Cambia la contraseña según sea necesario
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, hashedPassword)
            .input('rol', sql.VarChar, 'alumno') // Proporciona un valor para la columna 'rol'
            .query('INSERT INTO usuarios (username, password, rol) VALUES (@username, @password, @rol)');
        console.log('Usuario agregado con éxito');
        pool.close();
    } catch (err) {
        console.error('Error al agregar usuario:', err.message);
    }
}

hashPassword();
