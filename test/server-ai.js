'use strict';

// Load up our variables from .env--the chamber of secrets! .env keeps our keys safe, but we can load them here to make our services work
require('dontenv').config();

// App dependencies--we need these for our app to run
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');
// express is a nodejs library that does our "heavy lifting", cors is a middleman that allows our server to talk to others (cross origin resource sharing), superagent is an ajax library and deals with requests, pg is for postgres our sql database

// App Setup
const app = express();
app.use(cors());
const PORT = process.env.PORT
// here we make sure we are turning things on--we are using express now, and making sure htat uses cors, and we are also declaring our PORT

// Connect to the Database
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err=>console.log(err));
// client is our database and here we are declaring that and connecting to it, as well as setting up an error to throw in case things go wrong

// I think I want to check if server is listening once I set things up but before I try to ask for anything...
app.listen(PORT, ()=> console.log(`city explorer's backend is up and running on ${PORT}, y\'all!`))

// Same with error handling, just in case
function errorHandler(err, resp){
  console.error(err);
  if (resp) resp.status(500).send('Whoopsies! We\'d better fix that!');
}

// API routes
app.get('/location', locationFn);
app.get('/weather', weatherFn);
app.get('/events', eventFn);
app.get('/movies', movieFn);
app.get('/yelp', yelpFn);
app.get('/trails', trailsFn)
// we are telling express to go get these things, giving an endpoint and the helper function. Speaking of which...

// HELPER FUNCTIONS
// these will augment helper fn to be DRY coded
function getDataFromDB(sqlInfo){
  // create the SQL statement based on endpoints and conditions (the only difffernces between the syntax)
  let condition = '';
  let values = [];

  // if we have it we assign conition to query and values to sqlInfo.qry
  if (sqlInfo.searchQuery){
    condition = 'search_query';
    values = [sqlInfo.searchQuery];
  }else{
    // if we dont have it then we will
    condition = 'location_id';
    values = [sqlInfo.id];
  }

  let sql = `SELECT * FROM ${sqlInfo.endpoint}s WHERE ${condition}=$1;`

  // Get the data
  // ---try something, if it doesn't work give you an error
  // we use try catch becasue we are dealing with a promise and we are attempting it, rather than an if then in which case we would use throw.
  try { return client.query(sql, values); }
  catch (err) { errorHandler(err); }
}

function saveDataToDB(sqlInfo){
  // first create parameters placeholders
  let params = [];

  // now we need to get params so check the fn.
  for (let i = 1; i<= sqlInfo.values.length; i++){
    // we are dealing with actual counts not indexes
    params.push(`$${i}`);
  }

  let sqlParams = params.join()

  let sql = '';

  if (sqlInfo.searchQuery){
    // for location
    sql = `INSERT INTO ${sqlInfo.endpoint}s (${sqlInfo.columns}) VALUES (${sqlParams}) RETURNING ID;`
  }else{
    // all other endpoints
    sql =`INSERT INTO ${sqlInfo.endpoint}s (${sqlInfo.columns}) VALUES (${sqlParams});`
  }
  // save the data to our DB

  try{return client.query(sql, sqlInfo.values);}
  catch(err){errorHandler(err);}

}

// cache invalidation
// check data, if 


// fn to check if data is still valid
// is there data? if so get its age
function checkTimeouts(sqlInfo,sqlData){
  // establish timelength to keep data
// names singular

const timeouts = {
  weather: 15*1000, //15 seconds*1000 to get actual seconds insted of milli
  yelp: 60 * 1000 * 60 * 24, //*minutes*hours to get 1 day
  movie: 60 * 1000 * 60 * 24 * 30, // 30-Days
  event: 60 * 1000 * 60 * 6, // 6-Hours
  trail: 60 * 1000 * 60 * 24 * 7 // 7-Days
};

  if(sqlData.rowCount>0){
  //age of results will be current time/date 

  // check time at 9:27PM for checking age and deleting if it is old. and if it is not just return it back


  // we will call this fn in our getdata from DB section of helpers
  let ageOfResults = (Date.now() - sqlData.rows[0].created_at);

    // debugging
    console.log(sqlInfo.endpoint, ' age is ', ageOfResults);
    console.log(sqlInfo.endpoint, ' timeout is ', timeouts[sqlInfo.endpoint]);

    // compare the age of the result with the timeout value
    // if data is old: DELETE!!!!!
    if (ageOfResults > timeouts[sqlInfo.endpoint]) {
      let sql = `DELETE FROM ${sqlInfo.endpoint}s WHERE location_id=$1;`;
      let values = [sqlInfo.id];

      client.query(sql, values)
        .then(() => { return null; })
        .catch(err => handleError(err));

    } else { return sqlData; }

  }
  return null;
}

//Helper Functions!

function locationFn(req, resp){

  // NEW CODE FOR TEMPLATE
  let sqlInfo = {
    searchQuery : req.query.data,
    endpoint : 'locations',
  };

  // make the query of the DB
  // instead of client.query(sql, values)...
  getDataFromDB(sqlInfo)
  .then(res=>{
    // did DB return any info?
    if (res.rowCount>0){
      resp.send(res.rows[0]);
      console.log('location from db');
    }else{
      // if no rows, no info in db, then get come from API
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;

      superagent.get(url)
      .then(res=>{
        if(!res.body.results.length){throw 'NO DATA';
      }else{
        let location = new Location(sqlInfo.searchQuery, res.body.results[0]);


        // Instead of this... let newSQL = `INSERT INTO locations (search_query, formatted_address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING ID;`;
        sqlInfo.columns = Object.keys(location).join();
        // ^we have to format this array into a string, separated by commas so we use .join
        sqlInfo.values = Object.values(location);

        // client.query(newSQL, newValues)
        saveDataToDB(sqlInfo)
        .then(data=>{
          location.id = data.rows[0].id;
          resp.send(location);
        });
      }
      })
      .catch(err=>errorHandler(err,resp));
    }
  })
}

function weatherFn(req, resp){

  let sqlInfo = {
   // this info is from our location query. 
    id: req.query.data.id,
    //this is the id we newly iterate each time
    endpoint: 'weather'
  }

  getDataFromDB(sqlInfo)
  .then(data=>checkTimeouts(sqlInfo,data))
  .then(res=>{
    // result will be either true or false/"null"
    if (res){
      resp.send(res.rows);
    }else{
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

      superagent.get(url)
      //superagent is an ajax library and deals with requests
      .then(weatherResults=>{
        if(!weatherResults.body.daily.data.length){throw 'NO DATA'}else{
          const weatherSummaries = weatherResults.body.daily.data.map(day=>{
            let summary = new Weather(day);
            summary.location_id = sqlInfo.id;
            // ^we are attaching location id to summary id

            // here we are getting colummns and values and we send it up to our savetoDB fn where it'll go to the else statment
            sqlInfo.columns = Object.keys(summary).join();
            sqlInfo.values = Object.values(summary);
    
            
            saveDataToDB(sqlInfo)

            return summary;

          });
          resp.send(weatherSummaries);
        }
      })
      .catch(err=>errorHandler(err,resp));
    }
  });
}

function getEvents(request, response) {
  let sqlInfo = {
    id: req.query.id,
    endpoint: 'event',
  }
  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) {
        console.log('Event from SQL');
        response.send(result.rows);
      } else {
        const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

        superagent.get(url)
          .then(eventRes => {
            if (!eventRes.result.body.events.length) { throw 'NO DATA'; }
            else {
              const events = eventRes.body.events.map(eventData => {
                let event = new Event(eventData);
                event.location_id = sqlInfo.id;

                sqlInfo.columns = Object.keys(event).join();
                sqlInfo.values = Object.values(event);

                saveDataToDB(sqlInfo);

                return event;

              });

              resp.send(events);
            }
          })
          .catch(err => errorHandler(err, resp));
      }

// CONSTRUCTORS SECTION

// CONSTRUCTOR: Geographic Data
function Location(query, location){
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = locationgeometry.location.lat;
  this.longtitude = locaiton.geometry,location.lng;
}

// CONSTRUCTOR: Weather Data
function Weather(day){
  this.forecast = day.summary;
  this.time = new Date(day.time*1000).toDateString();
  this.created_at = Date.now();
  // in schema put after time category , 'created_at VARCHAR(255),'
}

// CONSTRUCTOR: Event Data
function Event(event) {
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
}

// CONSTRUCTOR: Yelp Data
function Yelp(yelp) {
  this.name = yelp.name;
  this.image_url = yelp.image_url;
  this.price = yelp.price;
  this.rating = yelp.rating;
  this.url = yelp.url;
}

// CONSTRUCTOR: Movie Data
function Movie(movie) {
  this.title = movie.original_title;
  this.overview = movie.overview;
  this.average_votes = movie.vote_average;
  this.total_votes = movie.vote_count;
  this.image_url = movie.poster_path;
  this.popularity = movie.popularity;
  this.released_on = movie.release_date;
}

// CONSTRUCTOR: Trail Data
// function Trail(trail){
//   this.name = ;
//   this.location = ;
//   this.length = ;
//   this.stars = ;
//   this.star_votes = ;
//   this.summary = ;
//   this.trail_url = ;
//   this.conditions = ;
//   this.condition_date = ;
//   this.condition_time = ;
// }