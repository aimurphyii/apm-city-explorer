-- schema for city explorer

DROP TABLE IF EXISTS weathers;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS yelps;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS trails;
DROP TABLE IF EXISTS locations;
-- put last because there may be dependencies. all other tables depend on our location table

CREATE TABLE locations(
  id SERIAL PRIMARY KEY,
  -- allows each record tohave a unique identifier
  search_query VARCHAR(255),
  -- allows for long names, but varchar will adapt spaces to fit name, up to 255
  formatted_query VARCHAR(255),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7)
);
-- psql -f schema.sql -d city_explorer command or you could just take all the commands and copy and paste into the postgres shell; you have to update database anytime oyu change schema

CREATE TABLE weathers(
  id SERIAL PRIMARY KEY, 
  forecast VARCHAR(255),
  time VARCHAR(255),
  created_at VARCHAR(255),
  location_id INTEGER NOT NULL,
  -- ^will be the id from the location table
  FOREIGN KEY (location_id) REFERENCES locations (id)
  -- (field in parenthesis) references the locations table, specifically the id field
);

-- update schema run psql -f schema.sql -d city_explorer

CREATE TABLE events(
  id SERIAL PRIMARY KEY,
  link VARCHAR (255),
  name VARCHAR(255),
  event_date VARCHAR(255),
  summary VARCHAR(500),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE movies(
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  overview VARCHAR(500),
  average_votes VARCHAR (255),
  total_votes VARCHAR (255),
  image_url VARCHAR(500),
  popularity VARCHAR (255),
  released_on VARCHAR(255),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE yelps(
  id SERIAL PRIMARY KEY,
  name VARCHAR(255), 
  image_url VARCHAR(255), 
  price VARCHAR(5), 
  rating VARCHAR (255), 
  url VARCHAR(255), 
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);

CREATE TABLE trails(
  name VARCHAR(255),
  location VARCHAR(255),
  length VARCHAR(255),
  stars VARCHAR(255),
  star_votes VARCHAR(255),
  summary VARCHAR(255),
  trail_url VARCHAR(255),  
  conditions VARCHAR(255),
  condition_date VARCHAR(255),
  condition_time VARCHAR(255),
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations (id)
);



-- when you deploy to HEROKU
-- nodemon make sure all is good and upto date working (use psql -f schema.sql -d city_explorer)
-- go to heroku website go to resources; go to addons go to postgres; choose hobbydev-free; go to settings and go to reveal config vars and you will see it created a database for you and you will push local database to heroku instance--it doesnt have your schema so you need to push it up.