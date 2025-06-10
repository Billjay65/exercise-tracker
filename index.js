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
// create and save a new exercise posted
const createAndSaveExercise = (exerciseData, done) => {
  const exercise = new Exercise(exerciseData);

  exercise.save((err, data) => {
    if (err) return done(err);
    done(null, data);
  });
};

// Log methods
// get all logs for a given user
const getLogsOfUser = (userId, done) => {
  User.findById(userId, (err, user) => {
    if (err) return done(err);
    if (!user) return done(new Error('User not found'));

    const username = user.username;

    Log.find({ username }, (err, logs) => {
      if (err) return done(err);
      done(null, {
        _id: user._id,
        username: username,
        count: logs.length,
        log: logs.map(e => ({
          description: e.description,
          duration: e.duration,
          date: e.date
        }))
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
    createAndSaveExercise(exerciseData, (err, exercise) => {
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

  getLogsOfUser(userId, (err, data) => {
    if (err) {
      return res.json({ error: 'Error retrieving logs' });
    }
    res.json(data);
  });
});
/*** endmyversion  ***/





const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
