'use strict';

// PROVIDE ACCESS TO ENVIRONMENT VARIABLES IN .env
require('dotenv').config();

// LOAD APPLICATION DEPENDENCIES
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// APPLICATION SETUP
const app = express();
app.use(cors());
const PORT = process.env.PORT;

//CONNECT TO DATABASE
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.log(err));

// API ROUTES--we wrap things up and send them witha get method. server is waiting for get method, and evaluates where the end point is going. Express is automatically passing request response to the helper fn
app.get('/location', searchToLatLong);
app.get('/weather', getWeather);
app.get('/events', getEvents);

// TURN THE SERVER ON
app.listen(PORT, () => console.log(`City Explorer Backend is up on ${PORT}`));

// ERROR HANDLER
function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

// HELPER FUNCTIONS

// DRY up our code
// 1. Look for similar or duplicate code
//    a. SQL SELECT to check for data in the DB
//    b. SQL INSERT to data into the DB

function getDataFromDB(sqlInfo) {
  //we will create a search option dynamically
  // Create a SQL Statement
  let condition = '';
  let values = [];
// ^we start the var up here because we don't know what we want yet but we want the info available to the whole fn scope
  if (sqlInfo.searchQuery) {//does that exist?/if it does we are coming form /location, and if not, we already have our location look up and we will move on to the else
    condition = 'search_query';
    values = [sqlInfo.searchQuery];//here the value is just  the city name
  } else {
    condition = 'location_id';
    values = [sqlInfo.id];//here the value may be mu,tiple for the different days
  }

  let sql = `SELECT * FROM ${sqlInfo.endpoint}s WHERE ${condition}=$1;`;

  // Get the Data and Return
  try { return client.query(sql, values);}//this returns to location,fn 
  catch (error) { handleError(error); }
}

function saveDataToDB(sqlInfo) {
  // Create the parameter placeholders
  let params = [];

  for (let i = 1; i <= sqlInfo.values.length; i++) {
    params.push(`$${i}`);//this is why we left values as an array!! we atrt at 1 because our SQL command needs to be $1,$2... it starts at 1 not as indexing. 
  }

  let sqlParams = params.join();
  //now that we put our dollar signs on it, we can make it a string to drop into our values section.

  let sql = '';
  if (sqlInfo.searchQuery) {
    //^ sqlInfo.searchQuery = /location endpoint
    sql = `INSERT INTO ${sqlInfo.endpoint}s (${sqlInfo.columns}) VALUES (${sqlParams}) RETURNING ID;`;
  } else {
    // all other endpoints
    sql = `INSERT INTO ${sqlInfo.endpoint}s (${sqlInfo.columns}) VALUES (${sqlParams});`;
  }

  // save the data--for use in getdatafromDB fn
  try { return client.query(sql, sqlInfo.values);}
  catch (err) { handleError(err); }
}

// CACHE INVALIDATION:

// 1.	Get data from the DB
// 2.	Check to see if the data is expired
// a.	Expired => get new data from API, Save to DB, return
// b.	Good => return existing data

// Establish the length of time to keep data for each resource
// NOTE: the names are singular so they can be dynamically used
// The weather timeout MUST be 15 seconds for this lab. You can change
// The others as you see fit... or not.

// Check to see if the data is still valid
function checkTimeouts(sqlInfo, sqlData) {
  // sqlinfo obj, and result from GET database comes in as SQLdata

  const timeouts = {
    weather: 15 * 1000, // 15-seconds
    yelp: 24 * 1000 * 60 * 60, // 24-Hours
    movie: 30 * 1000 * 60 * 60 * 24, // 30-Days
    event: 6 * 1000 * 60 * 60, // 6-Hours
    trail: 7 * 1000 * 60 * 60 * 24 // 7-Days
  };
  // ^we defined by endpoint so that we can dynmaiclally look the info for this obj

  // if there is data, find out how old it is.--we are checing here instead of in fn because we care if the data is old. 
  if (sqlData.rowCount > 0) {
    let ageOfResults = (Date.now() - sqlData.rows[0].created_at);

    // For debugging only
    console.log(sqlInfo.endpoint, ' AGE:', ageOfResults);
    console.log(sqlInfo.endpoint, ' Timeout:', timeouts[sqlInfo.endpoint]);
// don't submit stuff like this^


    // Compare the age of the results with the timeout value
    // Delete the data if it is old
    if (ageOfResults > timeouts[sqlInfo.endpoint]) {
      let sql = `DELETE FROM ${sqlInfo.endpoint}s WHERE location_id=$1;`;
      let values = [sqlInfo.id];
      client.query(sql, values)
        .then(() => { return null; })
        // anonymous fn because we dont care about the data we jsut care that it was deleted--we want to return null because we are doing a consitional question on the response that comes back
        .catch(error => handleError(error));
    } else { return sqlData; //we return this if the results are good}
  }
  return null;
}

function searchToLatLong(request, response) {
  let sqlInfo = {
    searchQuery: request.query.data,//comes form front end, request will have query property with data object in it
    endpoint: 'location'
  };

  getDataFromDB(sqlInfo)//we will now send this created object ot get db-data, server will check with data base to see if info is there. see line 43
    .then(result => {//sqlinfo is coming into result
      if (result.rowCount > 0) {
        response.send(result.rows[0]);//response.send converts for us--ajax call is on fron end
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`;//we make this statement to search and superagent will go out and get this info from the url(the url for that API server) and send it into result.

        superagent.get(url)
          .then(result => {//we first will check length to varify information, and not just send back a blank
            if (!result.body.results.length) { throw 'NO DATA'; }//we use throw because it breaks us out of the promise, the catch will get that error
            else {
              let location = new Location(sqlInfo.searchQuery, result.body.results[0]);//pass in sqlinfoquery and the reults list to create a new locatio nobject

              sqlInfo.columns = Object.keys(location).join();
              sqlInfo.values = Object.values(location);
              // ^here we are building out the columns andn the values for when we sotre this into the database. columns is joining the all the keys, because we need them as a string to pass it inot our database fn

              saveDataToDB(sqlInfo)
                .then(data => {
                  location.id = data.rows[0].id;//this is the accumulated id each instance, this is how  we differentiate between the differnt location, 0 is going to be the most newly created.(from line 85)
                  response.send(location);
                });
            }
          })
          .catch(error => handleError(error, response));
      }
    });
}

function getWeather(request, response) {

  let sqlInfo = {
    // this info is from our location query. 
    id: request.query.data.id,//this is the id we newly iterate each time
    endpoint: 'weather'
  };

  getDataFromDB(sqlInfo)
    .then(data => checkTimeouts(sqlInfo, data))
    .then(result => {
      if (result) { response.send(result.rows); }
      else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;

        return superagent.get(url)
          .then(weatherResults => {
            console.log('Weather from API');
            if (!weatherResults.body.daily.data.length) { throw 'NO DATA'; }
            else {
              const weatherSummaries = weatherResults.body.daily.data.map(day => {
                let summary = new Weather(day);
                summary.location_id = sqlInfo.id;

                sqlInfo.columns = Object.keys(summary).join();
                sqlInfo.values = Object.values(summary);

                saveDataToDB(sqlInfo);
                return summary;
              });
              response.send(weatherSummaries);
            }
          })
          .catch(error => handleError(error, response));
      }
    });
}

function getEvents(request, response) {
  const url = `https://www.eventbriteapi.com/v3/events/search?token=${process.env.EVENTBRITE_API_KEY}&location.address=${request.query.data.formatted_query}`;

  superagent.get(url)
    .then(result => {
      const events = result.body.events.map(eventData => {
        const event = new Event(eventData);
        return event;
      });

      response.send(events);
    })
    .catch(error => handleError(error, response));
}

//DATA MODELS
function Location(query, location) {
  //use more semantic name, like location DATA, query is actually location, while the location bit is actully bringing the api results
  this.search_query = query;
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
  this.created_at = Date.now();
  // ^we are going to attach location_id as a addt'l property, so it lines up properly--our ordering in schema and constructor must match! this is added manually into schema so it will be before location is 

}

function Event(event) {
  this.link = event.url;
  this.name = event.name.text;
  this.event_date = new Date(event.start.local).toString().slice(0, 15);
  this.summary = event.summary;
}

// function Yelp(yelp){
//   this.
// }

// function Movie(movie){
//   this.title = ;
//   this.overview = ;
//   this.average_votes = ;
//   this.total_votes = ;
//   this.image_url = ;
//   this.popularity = ;
  
// }
}