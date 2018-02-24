var db = require('../db.js');

const fs = require('fs');
const request = require('request');
const googleMaps = require('@google/maps').createClient({ key: 'AIzaSyDgTT27dxGtMUKso84YXTvAV48x9923pO8', Promise: Promise});



exports.all = function() {
    return new Promise((resolve, reject) => {
        db.get().query('SELECT * FROM venues', function(err, result) {
            if (err) return reject(err);
            return resolve({ success: true, count: result.length, result: result });
        });
    });
}

exports.findById = function(id) {
    return new Promise((resolve, reject) => {
        db.get().query('SELECT * FROM venues WHERE id = ?', id, function(err, result) {
            if (err) return reject(err);
            return resolve({ success: true, result: result });
        });
    });
}

exports.create = function(venue) {
    return new Promise((resolve, reject) => {
        db.get().query('INSERT INTO venues (raw_name) VALUES(?)', venue, function(err, result) {
            if (err) return reject(err);
            return resolve({ success: true, id: result.insertId });
        });
    });
}

exports.findByName = function(name) {
    return new Promise((resolve, reject) => {
        db.get().query('SELECT * FROM venues WHERE raw_name = ?', name, function(err, result) {
            if (err) return reject(err);
            return resolve({ success: true, result: result });
        });
    });
}

exports.findOrCreate = function(name) {
    return new Promise((resolve, reject) => {
        db.get().query('SELECT * FROM venues WHERE raw_name = ?', name, function(err, result) {
            if (err) return reject(err);
            if (result.length > 0) {
                console.log("Venue found");
                return resolve({ success: true, result: result });
            } else {
                console.log("Venue not found. Creating... " + name);
                exports.create(name).then(result => {
                    if (result.success) {
                        exports.findById(result.id).then(result => {
                            return resolve({ success: true, result: result.result });
                        }).catch(err => {return reject(err)});
                    }
                }).catch(err => {return reject(err)});
            }
        });
    });
}

exports.storePreciseInfo = function(venue) {
    return new Promise((resolve, reject) => {
        db.get().query('UPDATE venues SET name=?, place_id=?, address=?, image=?, price_level=?, rating=?, lat=?, lng=?  WHERE id = ?', [venue.name, venue.place_id, venue.address, venue.image, venue.price_level, venue.rating, venue.lat, venue.lng, venue.id], function(err, result) {
            if (err) return reject(err);
            return resolve({success: true, result: result});
        });
    });
}


exports.getAndStorePreciseLocation = async (location_id) => {
    try {
        const exists = await exports.findById(location_id);
        if (exists.success) {
            if (exists.result[0].place_id) {
                console.log("Precise location has already been stored.");
            } else {
                console.log("Venue found. Getting precise location for: " + exists.result[0].raw_name);
                const places_result = await googleMaps.places({query: exists.result[0].raw_name, language: 'en'}).asPromise();
                if (places_result.status === 200) console.log("Precise location found. Now getting picture with reference: " + places_result.json.results[0].photos[0].photo_reference);
                const places_photo = await googleMaps.placesPhoto({maxwidth: 600, photoreference: places_result.json.results[0].photos[0].photo_reference}).asPromise();
                console.log("Found photo");
                let filename = Date.now() + '.jpg';
                let path = '/img/' + filename;
                places_photo.pipe(fs.createWriteStream('./public/images/'+ filename));
                let venue = {
                    id: exists.result[0].id,
                    name: places_result.json.results[0].name,
                    place_id: places_result.json.results[0].place_id,
                    address: places_result.json.results[0].formatted_address,
                    image: path,
                    price_level: places_result.json.results[0].price_level,
                    rating: places_result.json.results[0].rating,
                    lat: places_result.json.results[0].geometry.location.lat,
                    lng: places_result.json.results[0].geometry.location.lng,
                };
                const venue_result = await exports.storePreciseInfo(venue);
                console.log("Precise Location stored");
            }
        } else {
            console.log( "Venue does not exist" );
        }
    } catch(err) {
        return err;
    }
}


