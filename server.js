const express = require('express');
const app = express();
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cookieParser = require('cookie-parser');
const path = require('path');

dotenv.config();

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'https://expense-tracker-omega-neon-97.vercel.app', // Vercel frontend URL
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
}));
app.use(cookieParser());

// Serve static files from the "public" directory
app.use(express.static('public'));

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // port: process.env.DB_PORT || 3306 // Port number (default to 3306)
});

// Check if database connection works
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        return;
    }
    console.log('Connected to MySQL as id:', db.threadId);

    // Create tables if they do not exist
    const createTables = () => {
        const usersTable = `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(100) NOT NULL UNIQUE,
            username VARCHAR(50) NOT NULL,
            password VARCHAR(255)
        )`;

        const expenseTable = `CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT,
            user_id INT NOT NULL,
            category VARCHAR(50) DEFAULT NULL,
            amount DECIMAL(10, 2) DEFAULT NULL,
            date DATE DEFAULT NULL,
            PRIMARY KEY(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`;

        const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
            session_id varchar(128) COLLATE utf8mb4_bin NOT NULL,
            expires int(11) unsigned NOT NULL,
            data text COLLATE utf8mb4_bin,
            PRIMARY KEY (session_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;`;

        db.query(usersTable, (err) => {
            if (err) console.log("Error creating users table:", err);
            else console.log("Users table created/checked");
        });

        db.query(expenseTable, (err) => {
            if (err) console.log("Error creating expenses table:", err);
            else console.log("Expense table created/checked");
        });

        db.query(createSessionsTable, (err) => {
            if (err) console.error("Error creating sessions table:", err);
            else console.log("Sessions table created/checked");
        });
    };

    createTables();
});

// Session store configuration
const sessionStore = new MySQLStore({}, db.promise());

// Session middleware
app.use(session({
    key: 'user_sid',
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 600000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' // Set to true if using HTTPS
    }
}));

// Middleware to clear cookie if session doesn't exist
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');
    }
    next();
});

// User registration route
app.post('/api/register', async (req, res) => {
    try {
        console.log("Received registration request:", req.body);
        const users = `SELECT * FROM users WHERE email = ?`;
        db.query(users, [req.body.email], (err, data) => {
            if (data.length > 0) return res.status(409).json("User already exists");

            // Hashing password
            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(req.body.password, salt);

            const newUser = `INSERT INTO users(email, username, password) VALUES(?)`;
            const value = [req.body.email, req.body.username, hashedPassword];
            db.query(newUser, [value], (err) => {
                if (err) {
                    console.log("Error inserting user:", err);
                    return res.status(400).json("Something went wrong");
                }
                return res.status(200).json("User created successfully");
            });
        });
    } catch (err) {
        console.log("Internal server error:", err);
        res.status(500).json("Internal Server Error");
    }
});

// User login route
app.post('/api/login', async (req, res) => {
    try {
        const users = `SELECT * FROM users WHERE email = ?`;
        db.query(users, [req.body.email], (err, data) => {
            if (data.length === 0) return res.status(404).json("User not found");

            const isPasswordValid = bcrypt.compareSync(req.body.password, data[0].password);
            if (!isPasswordValid) return res.status(400).json("Invalid Email or Password");

            req.session.user = data[0];
            res.status(200).json({ message: "Login successful", userId: data[0].id });
        });
    } catch (err) {
        res.status(500).json("Internal Server Error");
    }
});

// Endpoint to get current user information
app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        res.status(200).json({ username: req.session.user.username });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// Middleware to check if the user is authenticated
function authenticateUser(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json("Unauthorized");
    }
    next();
}

// Route to add a new expense
app.post('/api/expenses', authenticateUser, (req, res) => {
    const { category, amount, date } = req.body;
    const userId = req.session.user.id;

    const addExpenseQuery = `INSERT INTO expenses (user_id, category, amount, date) VALUES (?, ?, ?, ?)`;
    const values = [userId, category, amount, date];

    db.query(addExpenseQuery, values, (err) => {
        if (err) {
            return res.status(400).json("Error adding expense");
        }
        res.status(201).json("Expense added successfully");
    });
});

// Route to get all expenses for the authenticated user
app.get('/api/expenses', authenticateUser, (req, res) => {
    const userId = req.session.user.id;

    const getExpensesQuery = `SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC`;

    db.query(getExpensesQuery, [userId], (err, results) => {
        if (err) {
            return res.status(400).json("Error retrieving expenses");
        }
        res.status(200).json(results);
    });
});

// Route to update an existing expense
app.put('/api/expenses/:id', authenticateUser, (req, res) => {
    const expenseId = req.params.id;
    const { category, amount, date } = req.body;
    const userId = req.session.user.id;

    const updateExpenseQuery = `UPDATE expenses SET category = ?, amount = ?, date = ? WHERE id = ? AND user_id = ?`;
    const values = [category, amount, date, expenseId, userId];

    db.query(updateExpenseQuery, values, (err, result) => {
        if (err) {
            return res.status(400).json("Error updating expense");
        }
        if (result.affectedRows === 0) {
            return res.status(404).json("Expense not found or not authorized");
        }
        res.status(200).json("Expense updated successfully");
    });
});

// Route to delete an existing expense
app.delete('/api/expenses/:id', authenticateUser, (req, res) => {
    const expenseId = req.params.id;
    const userId = req.session.user.id;

    const deleteExpenseQuery = `DELETE FROM expenses WHERE id = ? AND user_id = ?`;

    db.query(deleteExpenseQuery, [expenseId, userId], (err, result) => {
        if (err) {
            return res.status(400).json("Error deleting expense");
        }
        if (result.affectedRows === 0) {
            return res.status(404).json("Expense not found or not authorized");
        }
        res.status(200).json("Expense deleted successfully");
    });
});

// Logout route
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json("Error logging out");
        }
        res.clearCookie('user_sid');
        res.status(200).json("Logout successful");
    });
});

// Route to check session status
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.status(200).json({ userId: req.session.user.id });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

// Serve the login page
// app.get('/login', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/login.html'));
// });

// // Serve the registration page
// app.get('/register', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/register.html'));
// });

// // Serve the expenses page (protected route)
// app.get('/expenses', authenticateUser, (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// Serve the homepage
app.get('/', (req, res) => {
    res.send("Welcome to the Expense Tracker");
});




// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}...`);
});

// // Serve the homepage
// app.get('', (req, res) => {
//     res.send("Welcome to the Expense Tracker");
// });

// // Serve the login page
// app.get('/login', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/login.html'));
// });

// // Serve the registration page
// app.get('/register', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/register.html'));
// });

// // Serve the expenses page (protected route)
// app.get('/expenses', authenticateUser, (req, res) => {
//     res.sendFile(path.join(__dirname, 'public/expenses.html'));
// });