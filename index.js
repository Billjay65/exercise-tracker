const express = require('express')
const app = express()
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors')
require('dotenv').config()

/*** myversion ***/
// connect to database
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// exercise Schema
const exerciseSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: String, // or use Date type for better handling
    required: true
  }
});

// user Schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  }
});

// log schema
const logSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true 
  },
  count: Number,
  log: [
    {
      description: {
        type: String, 
        required: true 
      },
      duration: { 
        type: Number, 
        required: true },
      date: { 
        type: String 
      }  
    }
  ]
});

// Create and Export Models
const Exercise = mongoose.model('Exercise', exerciseSchema);
const User = mongoose.model('User', userSchema);
const Log = mongoose.model('Log', logSchema);

// CRUD methods
// User methods
// create and save a user posted from form
const createAndSaveUser = (username, done) => {
  const user = new User({ username });

  user.save((err, data) => {
    if (err) return done(err);
    done(null, data);
  });
};

// get a list of all users from database
const getAllUsers = (done) => {
  User.find({}, (err, users) => {
    if (err) return done(err);
    done(null, users);
  })
}

// Exercise methods
// create and save new exercise posted and update log
const createAndSaveExerciseAndUpdateLog = (exerciseData, done) => {
  const exercise = new Exercise(exerciseData);

  exercise.save((err, savedExercise) => {
    if (err) return done(err);

    // Update or create log for this user
    Log.findOne({ username: savedExercise.username }, (err, logDoc) => {
      if (err) return done(err);

      const newExerciseEntry = {
        description: savedExercise.description,
        duration: savedExercise.duration,
        date: savedExercise.date
      };

      if (logDoc) {
        // update existing log
        logDoc.count += 1;
        logDoc.log.push(newExerciseEntry);
        logDoc.save((err, updatedLog) => {
          if (err) return done(err);
          done(null, savedExercise, updatedLog);
        });
      } else {
        // create new log
        const newLog = new Log({
          username: savedExercise.username,
          count: 1,
          log: [newExerciseEntry]
        });
        newLog.save((err, createdLog) => {
          if (err) return done(err);
          done(null, savedExercise, createdLog);
        });
      }
    });
  });
};

// Log methods
// get all logs for a given user
const getLogsOfUser = (userId, done) => {
  User.findById(userId, (err, user) => {
    if (err) return done(err);
    if (!user) return done(new Error('User not found'));

    const username = user.username;

    // find the single log for the user
    Log.findOne({ username }, (err, logDoc) => {
      if (err) return done(err);

      // If no log yet, return empty log
      if (!logDoc) {
        return done(null, {
          _id: user._id,
          username: user.username,
          count: 0,
          log: []
        });
      }

      // Format log entries with correct date format
      const formattedLog = logDoc.log.map(e => ({
        description: e.description,
        duration: e.duration,
        date: new Date(e.date).toDateString()
      }));

      done(null, {
        _id: user._id,
        username: user.username,
        count: logDoc.count,
        log: formattedLog
      });
    });
  });
};


module.exports = { Exercise, User, Log };

/*** end myversion ***/
app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

/*** myversion ***/
// parse data submitted using post request
app.use(bodyParser.urlencoded({extended: false}));

// new user api endpoint add submitted user to db
app.post('/api/users', function (req, res) {
  const user = req.body.username;

  // save user submitted to database
  createAndSaveUser(user, (err, data) => {
    if (err) return res.json({
      error: 'Error saving user'
    });

    // return the response as required
    res.json({
      username: data.username,
      _id: data._id
    })
  });
});

// get users api endpoint server
app.get('/api/users', function (req, res) {
  // return all users in db
  getAllUsers((err, data) => {
    if (err) return res.json({
      error: 'Error getting users'
    });
    
    // return the users array directly
    res.json(data);
  })
});

// save new exercise api endpoint server
app.post('/api/users/:_id/exercises', function (req, res) {
  // use req.params._id since it is a url parameter
  const userId = req.params._id;
  const description = req.body.description;
  const duration = Number(req.body.duration);

  // Set date: use provided date or current date
  let date;
  if (!req.body.date) {
    date = new Date();
  } else {
    date = new Date(req.body.date);
    if (isNaN(date)) {
      // invalid date fallback
      date = new Date();
    }
  }

  // prepare exercise object
  const exerciseData = {
    username: null, // will fill after fetching user
    description,
    duration,
    date: date.toDateString()
  };

  // find user by _id first to get username
  User.findById(userId, (err, user) => {
    if (err || !user) {
      return res.json({ error: 'User not found' });
    }

    exerciseData.username = user.username;

    // save exercise
    createAndSaveExerciseAndUpdateLog(exerciseData, (err, exercise) => {
      if (err) return res.json({ error: 'Error saving exercise' });

      // response object format:
      // { _id, username, date, duration, description }
      res.json({
        _id: user._id,
        username: user.username,
        date: exercise.date,
        duration: exercise.duration,
        description: exercise.description
      });
    });
  });
});

// get logs for a user api endpoint server
app.get('/api/users/:_id/logs', function (req, res) {
  const userId = req.params._id;

  // Extract query params
  const from = req.query.from ? new Date(req.query.from) : null;
  const to = req.query.to ? new Date(req.query.to) : null;
  const limit = req.query.limit ? parseInt(req.query.limit) : null;

  // validate date parameters if provided
  if ((from && isNaN(from)) || (to && isNaN(to))) {
    return res.json({ error: 'Invalid from or to date format' });
  }
  if (limit !== null && (isNaN(limit) || limit <= 0)) {
    return res.json({ error: 'Invalid limit parameter' });
  }

  getLogsOfUser(userId, (err, data) => {
    if (err) {
      return res.json({ error: 'Error retrieving logs' });
    }

    // filter logs if from - to provided
    let filteredLogs = data.log;

    if (from) {
      filteredLogs = filteredLogs.filter(logEntry => new Date(logEntry.date) >= from);
    }
    if (to) {
      filteredLogs = filteredLogs.filter(logEntry => new Date(logEntry.date) <= to);
    }

    // apply limit if provided
    if (limit) {
      filteredLogs = filteredLogs.slice(0, limit);
    }

    // return data with filtered log and updated count
    res.json({
      _id: data._id,
      username: data.username,
      count: filteredLogs.length,
      log: filteredLogs
    });
  });
});
/*** endmyversion  ***/



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
