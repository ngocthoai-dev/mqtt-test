var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

var usersRouter = require('./routes/users');
var indexRouter = require('./routes/index').router;
var schedule = require('./routes/schedule').fetch_schedule_water;
var msgAlert = require('./routes/msgAlert').checkInDangerTree;
var msgAlert = require('./routes/mqtt_connection').mqttConnection;

schedule();

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

hashing = require('./routes/custom_hashing');
const session = require('express-session');
const MemoryStore = require('memorystore')(session)
app.use(session({
  key: 'sec',
  secret: hashing.hash(hashing.getSecId(), {rounds: 20}),
  store: new MemoryStore({
    checkPeriod: 1000 * 60 * 60 * 24, // prune expired entries every 24h
  }),
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true, maxAge: 1000 * 60 * 60 * 24 } // expire after 1 day
}));

app.use(cookieParser(hashing.hash(hashing.getSecId(), {rounds: 20})));
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());
app.use(cors());

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
