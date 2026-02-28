const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
// const PORT = 8081;
const PORT = process.env.PORT || 8081;


// Adding the next 3 lines of the code to support image upload for the questions
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Define CORS options
const corsOptions = {
    origin: 'http://localhost:3000',  // Allow only the frontend origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // Specify allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'],  // Specify allowed headers
    credentials: true,  // Allow cookies and credentials
    optionsSuccessStatus: 200  // Return a successful status for OPTIONS requests
};
//app.use(cors(corsOptions));
// Middleware to handle OPTIONS preflight requests for all routes
app.options('*', cors(corsOptions));
// Use body-parser to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/ques_photos", express.static("D:/gpyq/ques_photos"));


// Create a connection to the local MySQL database
// const con = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'gpyq'
// });


const con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});


// Connect to the MySQL database
con.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});
// Middleware to add CORS headers to all responses (if not using the cors library)
// app.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin", "http://localhost:3000");
//     res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//     res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
//     res.header("Access-Control-Allow-Credentials", "true");
//     next();
// });


const allowedOrigins = [
  "http://localhost:3000",
  "https://gpyq-frontend.onrender.com"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  res.header("Access-Control-Allow-Credentials", "true");

  next();
});


app.get("/questions", (req, res) => {
    const { topic, subject, year } = req.query;
    let query;
    let params;

    if (topic) {
        query = `
            SELECT 
                q.*, 
                t.topic_name, 
                s.subject_name, 
                y.year 
            FROM questions q
            JOIN topics t ON q.topic_id = t.id
            JOIN subjects s ON q.subject_id = s.id
            JOIN years y ON q.year_id = y.id
            WHERE t.topic_name = ?
            ORDER BY q.id ASC
        `;
        params = [topic];
    } else if (subject) {
        query = `
            SELECT 
                q.*, 
                t.topic_name, 
                s.subject_name, 
                y.year 
            FROM questions q
            JOIN subjects s ON q.subject_id = s.id
            JOIN topics t ON q.topic_id = t.id
            JOIN years y ON q.year_id = y.id
            WHERE s.subject_name = ?
            ORDER BY q.id ASC
        `;
        params = [subject];
    } else if (year) {
        query = `
            SELECT 
                q.*, 
                t.topic_name, 
                s.subject_name, 
                y.year 
            FROM questions q
            JOIN years y ON q.year_id = y.id
            JOIN subjects s ON q.subject_id = s.id
            JOIN topics t ON q.topic_id = t.id
            WHERE y.year = ?
            ORDER BY q.id ASC
        `;
        params = [year];
    } else {
        res.status(400).json({ error: "Missing topic, subject, or year parameter" });
        return;
    }

    con.query(query, params, (error, results) => {
        if (error) {
            console.error("Database error:", error);
            res.status(500).json({ error: "Database error" });
            return;
        }

        res.json(results);
    });
});


app.get("/topics", (req, res) => {
    let query = `
        SELECT s.subject_name, t.topic_name 
        FROM topics t
        LEFT JOIN subjects s ON t.subject_id = s.id;
    `;

    con.query(query, (error, results) => {
        if (error) {
            console.error("Database error:", error);
            res.status(500).json({ error: "Database error" });
            return;
        }

        if (results.length === 0) {
            console.log("⚠️ No topics found.");
            res.json([]);
            return;
        }

        // Organize data by subjects
        const subjectTopicsMap = {};
        results.forEach(row => {
            if (!subjectTopicsMap[row.subject_name]) {
                subjectTopicsMap[row.subject_name] = [];
            }
            subjectTopicsMap[row.subject_name].push(row.topic_name);
        });

        // Convert to structured format
        const structuredTopics = Object.keys(subjectTopicsMap).map(subject => ({
            subject_name: subject,
            topics: subjectTopicsMap[subject]
        }));
        res.json(structuredTopics);
    });
});


app.get("/UploadDropDownSubjects", (req, res) => {
    const sql = "SELECT id, subject_name FROM subjects"; // Query to fetch subjects
    con.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching subjects:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(result); // Send subjects as JSON response
    });
});

app.get("/UploadDropDownTopics", (req, res) => {
    const subjectId = req.query.subject_id; // Get subject_id from request

    if (!subjectId) {
        return res.status(400).json({ error: "Subject ID is required" });
    }

    const sql = "SELECT id, topic_name FROM topics WHERE subject_id = ?";
    
    con.query(sql, [subjectId], (err, result) => {
        if (err) {
            console.error("Error fetching topics:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(result); // Send topics as JSON response
    });
});

app.get("/UploadDropDownYears", (req, res) => {
    const sql = "SELECT id, year FROM years"; // Correct SQL query
    con.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching years:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(result); // Send years as JSON response
    });
});

// Below code till uploadQuestion is to support image upload
const uploadBasePath = "D:/gpyq/ques_photos";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { year_id } = req.body;

    // Get year value from DB
    con.query("SELECT year FROM years WHERE id = ?", [year_id], (err, result) => {
      if (err || result.length === 0) {
        return cb(new Error("Invalid year"));
      }

      const yearFolder = path.join(uploadBasePath, result[0].year.toString());

      // Create folder ONLY if it does not exist
      if (!fs.existsSync(yearFolder)) {
        fs.mkdirSync(yearFolder, { recursive: true });
      }

      cb(null, yearFolder);
    });
  },

  filename: (req, file, cb) => {
    const { year_id, subject_id } = req.body;

    // Get year & subject name
    con.query(
      `SELECT y.year, s.subject_name 
       FROM years y, subjects s 
       WHERE y.id = ? AND s.id = ?`,
      [year_id, subject_id],
      (err, result) => {
        if (err || result.length === 0) {
          return cb(new Error("Invalid subject or year"));
        }

        const year = result[0].year.toString();
        const subjectName = result[0].subject_name.replace(/\s+/g, "_");

        const yearFolder = path.join(uploadBasePath, year);

        // Count existing files in year folder
        const existingFiles = fs.readdirSync(yearFolder)
          .filter(f => f.match(/^\d+_/));

        const nextNumber = existingFiles.length + 1;

        const ext = path.extname(file.originalname);
        const finalName = `${nextNumber}_${subjectName}${ext}`;

        req.uploadYear = year;

        cb(null, finalName);
      }
    );
  }
});

const upload = multer({ storage });


app.post("/uploadQuestion", upload.single("image"), (req, res) => {
    const { question_text,code, remaining_question, 
        option_a, option_b, option_c, option_d, 
        correct_option, explanation,
        year_id, subject_id, topic_id } = req.body;

    const image_url = req.file ? `${req.uploadYear}/${req.file.filename}` : null;

    const sql = "INSERT INTO questions (question_text, code, remaining_question, option_a, option_b, option_c, option_d, correct_option, explanation, image_url, year_id, subject_id, topic_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    con.query(sql, [question_text, code, remaining_question, option_a, option_b, option_c, option_d, correct_option, explanation, image_url, year_id, subject_id, topic_id], (err, result) => {
        if (err) {
            console.error("Error inserting question:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ success: true, message: "Question uploaded successfully" });
    });
});


// API Route to Register a Student
app.post("/studentsregister", (req, res) => {
    const { firstName, lastName, number, email, password } = req.body;
  
    const sql =
      "INSERT INTO students (first_name, last_name, contact_number, email, password) VALUES (?, ?, ?, ?, ?)";
  
    con.query(sql, [firstName, lastName, number, email, password], (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).json({ message: "Registration failed" });
      }
      res.status(200).json({ message: "Registration successful" });
    });
  });

  // API Route to Login a Student
  app.post("/studentlogin", (req, res) => {
    const { email, password } = req.body;
  
    const sql = "SELECT * FROM students WHERE email = ?";
    con.query(sql, [email], (err, results) => {
      if (err) return res.json({ success: false, message: "Database error" });
  
      if (results.length > 0) {
        // Check if the password matches
        if (results[0].password === password) {
          return res.json({ 
            success: true, 
            message: "Login successful",
            user: {
                id: results[0].id,
                first_name: results[0].first_name
            } });
        } else {
          return res.json({ success: false, message: "Password not same" });
        }
      } else {
        return res.json({ success: false, message: "User not found" });
      }
    });
  });

    // Bookmarking the questions
    app.post("/bookmark", (req, res) => {
    console.log("Bookmark API called"); // Log when API is hit

    const { user_id, question_id } = req.body;

    console.log("Received Data:", req.body); // Log request data

    if (!user_id || !question_id) {
        console.log("Error: Missing user_id or question_id"); // Log missing data
        return res.json({ success: false, message: "Missing user or question ID" });
    }

    // Check if already bookmarked
    const checkSql = "SELECT * FROM bookmarks WHERE user_id = ? AND question_id = ?";
    con.query(checkSql, [user_id, question_id], (checkErr, checkResults) => {
        if (checkErr) {
            console.log("Database Error:", checkErr); // Log database error
            return res.json({ success: false, message: "Database error" });
        }

        console.log("Check Results:", checkResults); // Log existing bookmark check

        if (checkResults.length > 0) {
            console.log("Already bookmarked"); // Log if already bookmarked
            return res.json({ success: false, message: "Already bookmarked" });
        }

        // Insert new bookmark
        const insertSql = "INSERT INTO bookmarks (user_id, question_id) VALUES (?, ?)";
        con.query(insertSql, [user_id, question_id], (err, results) => {
            if (err) {
                console.log("Database Insert Error:", err); // Log insertion error
                return res.json({ success: false, message: "Database error" });
            }

            console.log("Bookmark Inserted:", results); // Log successful insert
            return res.json({ success: true, message: "Bookmarked successfully" });
        });
    });
});


// ✅ Fetch all bookmarked question IDs for a user
app.get("/getBookmarks", (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.json({ success: false, message: "Missing user ID" });
    }

    const sql = "SELECT question_id FROM bookmarks WHERE user_id = ?";
    con.query(sql, [user_id], (err, results) => {
        if (err) return res.json({ success: false, message: "Database error" });

        return res.json({ success: true, bookmarks: results });
    });
});

app.get("/getBookmarkedQuestions", (req, res) => {
    const { user_id } = req.query;
    
    if (!user_id) {
        return res.status(400).json({ success: false, message: "Missing user ID" });
    }

    const query = `
        SELECT q.* FROM questions q
        JOIN bookmarks b ON q.id = b.question_id
        WHERE b.user_id = ?;
    `;

    con.query(query, [user_id], (error, results) => {
        if (error) {
            console.error("Database error:", error);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        res.json({ success: true, questions: results });
    });
});

// ✅ Removing a bookmarked question
app.post("/removeBookmark", (req, res) => {
    console.log("Remove Bookmark API called");

    const { user_id, question_id } = req.body;

    if (!user_id || !question_id) {
        console.log("Error: Missing user_id or question_id");
        return res.json({ success: false, message: "Missing user or question ID" });
    }

    const deleteSql = "DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?";
    con.query(deleteSql, [user_id, question_id], (err, result) => {
        if (err) {
            console.log("Database Delete Error:", err);
            return res.json({ success: false, message: "Database error" });
        }

        console.log("Bookmark Removed:", result);
        return res.json({ success: true, message: "Bookmark removed successfully" });
    });
});


// For the Random question page
app.get("/getRandomQuestion", (req, res) => {
    const sql = "SELECT * FROM questions WHERE id >= (SELECT FLOOR(RAND() * (SELECT MAX(id) FROM questions))) LIMIT 1;"; // Fetch 1 random question
    
    con.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching random question:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(result[0]); // Return the first (random) question
    });
});

// When the user will click on the Manual Test start
app.get("/subjects-with-topics", (req, res) => {
    const sql = `
        SELECT s.id AS subject_id, s.subject_name, t.id AS topic_id, t.topic_name
        FROM subjects s
        LEFT JOIN topics t ON s.id = t.subject_id
        ORDER BY s.subject_name, t.topic_name;
    `;

    con.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching subjects with topics:", err);
            return res.status(500).json({ error: "Database error" });
        }

        const subjectMap = {};
        results.forEach(row => {
            if (!subjectMap[row.subject_id]) {
                subjectMap[row.subject_id] = {
                    id: row.subject_id,
                    name: row.subject_name,
                    topics: []
                };
            }
            if (row.topic_id) {
                subjectMap[row.subject_id].topics.push({
                    id: row.topic_id,
                    name: row.topic_name
                });
            }
        });

        const structuredSubjects = Object.values(subjectMap);
        res.json(structuredSubjects);
    });
});

//For starting the server timer in the backend
app.post("/start-manual-test", (req, res) => {
  const { user_id, questionCount, testDuration, selectedTopics } = req.body;

  if (!user_id || !questionCount || !testDuration || !selectedTopics?.length) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const topicIds = JSON.stringify(selectedTopics); // or comma-separated
  const sql = `
    INSERT INTO tests (user_id, start_time, duration_minutes, question_count, topic_ids)
    VALUES (?, NOW(), ?, ?, ?)
  `;

  con.query(sql, [user_id, testDuration, questionCount, topicIds], (err, result) => {
    if (err) {
      console.error("Error creating test:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json({
      test_id: result.insertId,
      start_time: new Date(), // Server timestamp
      duration: testDuration
    });
  });
});


//For showing the questions related to the topics selected by the users for their manual test.
app.post("/get-questions-for-test", (req, res) => {
    const { topicIds, questionCount } = req.body;

    if (!topicIds || !Array.isArray(topicIds) || topicIds.length === 0 || !questionCount) {
        return res.status(400).json({ error: "Invalid input" });
    }

    const placeholders = topicIds.map(() => '?').join(',');
    const sql = `
        SELECT * FROM questions
        WHERE topic_id IN (${placeholders})
        ORDER BY RAND()
        LIMIT ?
    `;

    con.query(sql, [...topicIds, parseInt(questionCount)], (err, results) => {
        if (err) {
            console.error("Error fetching questions:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

//Below 2 API's are for editing the question module
// ✅ Get question by ID for editing the question
app.get("/questions/:id", (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM questions WHERE id = ?";
    con.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error fetching question:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Question not found" });
        }
        res.json(results[0]); // return single question
    });
});

// ✅ Update question by ID
// app.put("/questions/:id", (req, res) => {
//     const { id } = req.params;
//     const {
//         question_text, code, remaining_question,
//         option_a, option_b, option_c, option_d,
//         correct_option, explanation, image_url,
//         year_id, subject_id, topic_id
//     } = req.body;

//     const sql = `
//       UPDATE questions SET
//         question_text = ?, code = ?, remaining_question = ?,
//         option_a = ?, option_b = ?, option_c = ?, option_d = ?,
//         correct_option = ?, explanation = ?, image_url = ?,
//         year_id = ?, subject_id = ?, topic_id = ?
//       WHERE id = ?
//     `;

//     con.query(sql, [
//         question_text, code, remaining_question,
//         option_a, option_b, option_c, option_d,
//         correct_option, explanation, image_url,
//         year_id, subject_id, topic_id, id
//     ], (err, result) => {
//         if (err) {
//             console.error("Error updating question:", err);
//             return res.status(500).json({ error: "Database error" });
//         }
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ error: "Question not found" });
//         }
//         res.json({ success: true, message: "Question updated successfully" });
//     });
// });

app.put("/questions/:id", upload.single("image"), (req, res) => {
  const { id } = req.params;
  const {
    question_text, code, remaining_question,
    option_a, option_b, option_c, option_d,
    correct_option, explanation,
    year_id, subject_id, topic_id
  } = req.body;

  con.query(
    "SELECT image_url FROM questions WHERE id = ?",
    [id],
    (err, result) => {
      if (err || result.length === 0) return res.status(404).json({ error: "Not found" });

      let oldImage = result[0].image_url;
      let newImagePath = oldImage;

      if (req.file) {
        newImagePath = `${req.uploadYear}/${req.file.filename}`;

        // delete old image
        if (oldImage) {
          const fullOldPath = path.join(uploadBasePath, oldImage);
          if (fs.existsSync(fullOldPath)) fs.unlinkSync(fullOldPath);
        }
      }

      const sql = `
        UPDATE questions SET
          question_text=?, code=?, remaining_question=?,
          option_a=?, option_b=?, option_c=?, option_d=?,
          correct_option=?, explanation=?, image_url=?,
          year_id=?, subject_id=?, topic_id=?
        WHERE id=?
      `;

      con.query(sql, [
        question_text, code, remaining_question,
        option_a, option_b, option_c, option_d,
        correct_option, explanation, newImagePath,
        year_id, subject_id, topic_id, id
      ], err => {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ success: true });
      });
    }
  );
});




// Start the server and listen on the specified port
const server = app.listen(PORT, () => {
    const port = server.address().port;
    console.log(`Server is ON and listening on port ${port}!`);
});