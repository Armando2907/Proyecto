const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const path = require('path'); // Módulo path para trabajar con rutas de archivos

const app = express();
app.use(express.json());

// Configuración de la conexión a la base de datos MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'bdweb'
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Conexión a la base de datos establecida');
});

// Función para generar el token JWT
function generarToken(userId) {
  return jwt.sign({ userId }, 'secreto', { expiresIn: '1h' });
}

// Middleware para verificar el token JWT
function verificarToken(req, res, next) {
  const token = req.headers.authorization;
  console.log('Token JWT recibido en verificarToken:', token); // Agregar esta línea para imprimir el token recibido
  if (!token) return res.status(401).send('Token no proporcionado');

  jwt.verify(token, 'secreto', (err, decoded) => {
    if (err) {
      console.error('Error al verificar el token JWT:', err);
      return res.status(403).send('Token expirado o inválido');
    }
    req.userId = decoded.userId;
    next();
  });
}

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para manejar la solicitud GET a la URL raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Endpoint de login
app.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  const sql = `SELECT id FROM usuarios WHERE usuario = ? AND password = ?`;
  connection.query(sql, [usuario, password], (err, result) => {
    if (err) return res.status(500).send('Error en el servidor');
    if (result.length === 0) return res.status(401).send('Credenciales inválidas');

    const userId = result[0].id;
    const token = generarToken(userId);
    res.send({ token });
  });
});

// Endpoint para crear una cuenta de usuario
app.post('/crear-cuenta', (req, res) => {
  const { usuario, password } = req.body;
  const sql = `INSERT INTO usuarios (usuario, password) VALUES (?, ?)`;
  connection.query(sql, [usuario, password], (err, result) => {
    if (err) return res.status(500).send('Error en el servidor');
    res.send('Cuenta creada exitosamente');
  });
});

app.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;
  const sql = 'SELECT usuario FROM usuarios WHERE id = ?';
  connection.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('Error al consultar la base de datos:', err);
      return res.status(500).send('Error al consultar la base de datos');
    }
    if (result.length === 0) {
      return res.status(404).send('Usuario no encontrado');
    }
    const username = result[0].usuario;
    res.json({ username });
  });
});

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, 'secreto', (err, user) => { // Cambio aquí
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Endpoint para almacenar un dibujo
app.post('/guardar-dibujo', authenticateToken, (req, res) => {
  console.log('Datos recibidos para guardar el dibujo:', req.body); // Agregar este console.log
  const { nombre, tipo, datos } = req.body;
  const userId = req.user.userId; 

  // Guarda el dibujo en la base de datos
  connection.query(
    'INSERT INTO dibujos (nombre, tipo, datos, usuario_id) VALUES (?, ?, ?, ?)',
    [nombre, tipo, datos, userId],
    (error, results) => {
      if (error) {
        console.error('Error al guardar el dibujo:', error);
        res.sendStatus(500);
        return;
      }
      res.sendStatus(200);
    }
  );
});

// Endpoint para obtener los dibujos del usuario
app.get('/dibujos', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  connection.query(
    'SELECT id, nombre, tipo, datos FROM dibujos WHERE usuario_id = ?',
    [userId],
    (error, results) => {
      if (error) {
        console.error('Error al obtener los dibujos:', error);
        res.sendStatus(500);
        return;
      }
      
      const dibujos = results.map(dibujo => {
        return {
          id: dibujo.id,
          nombre: dibujo.nombre,
          tipo: dibujo.tipo,
          datos: dibujo.datos.toString('base64')
        };
      });

      console.log('Datos de los dibujos obtenidos de la base de datos:', dibujos);
      res.json(dibujos);
    }
  );
});

// Endpoint para eliminar un dibujo
app.delete('/eliminar-dibujo/:dibujoId', authenticateToken, (req, res) => {
  const dibujoId = req.params.dibujoId;
  const userId = req.user.userId;

  const sql = 'DELETE FROM dibujos WHERE id = ? AND usuario_id = ?';
  connection.query(sql, [dibujoId, userId], (error, results) => {
    if (error) {
      console.error('Error al eliminar el dibujo:', error);
      res.sendStatus(500);
      return;
    }
    if (results.affectedRows === 0) {
      res.status(404).send('Dibujo no encontrado o no autorizado para eliminarlo');
    } else {
      res.sendStatus(200);
    }
  });
});


// Puerto de escucha del servidor
const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor iniciado en http://localhost:${PORT}`));
