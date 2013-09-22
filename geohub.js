var request = require('request'),
    async = require('async');

var suffix = ".geojson";
module.exports = {

  // scan repo for "geojson files"
  repo: function( user, repo, path, token, callback ){
    var self = this,
      url;
    if ( user && repo && path ){
      url = 'https://api.github.com/repos/'+ user + '/' + repo + '/contents/' + path + '.geojson' + ((token) ? '?access_token=' + token : '');
      request({uri: url, json: true}, function( error, response, fileInfo ){
        if (!error && response.statusCode == 200) {
          var sha = fileInfo.sha;
          self.getRepoFile(user, repo, {path: path, sha: sha}, callback);
        }
      });
    } else if ( user && repo ){
      self.repoFileList(user, repo, token, function(err, files) {
        if (err) {
          callback(err);
        } else {
        if (files.length > 0) {
          self.getRepoFiles( user, repo, files, callback );
        } else {
          callback('Error: could not find any geojson at ' + url, null);
        }
      }
    });
    } else {
      callback("Error: must specify at least a username and repo");
    }
  },

  repoFileList: function( user, repo, token, callback) {
      // scan the repo contents
      url = 'https://api.github.com/repos/'+ user + '/' + repo + '/git/refs/heads' + ((token) ? '?access_token=' + token : '');
      request({uri: url, json: true}, function( error, response, body ){
        if (!error && response.statusCode == 200 && body.length > 0) {
          var sha = body[0].object.sha;
          url = 'https://api.github.com/repos/'+ user + '/' + repo + '/git/trees/' + sha + '?recursive=1' + ((token) ? '&access_token=' + token : '');
          request({uri: url, json: true}, function( error, response, body ){
            if (error) {
              callback(error);
            } else {
          var files = body.tree;
          files = files.filter(function(item){
            return (item.type === "blob" && item.path.indexOf(suffix, item.path.length - suffix.length) !== -1);
          }).map(function(item){
            return {path: item.path.slice(0,-(suffix.length)), sha: item.sha};
          });
          callback(null, files);
        }
          });
        } else {
          callback('Error: ' + error, null);
        }
      });
  },

  getRepoFile: function(user, repo, item, callback) {
    url = 'https://api.github.com/repos/' + user + '/' + repo + '/git/blobs/' + item.sha;
    request({uri: url, headers: {Accept: "application/json"}, json: true}, function( error, response, body ){
    if (error || response.statusCode < 200) {
      callback(error || response.statusCode);
    } else {
      var geojson = JSON.parse((new Buffer(response.body.content, 'base64')).toString('utf8'));
      geojson.name = item.path;
      geojson.sha = item.sha;
      callback(null, geojson);
    }
    });
  },

  getRepoFiles: function(user, repo, items, callback) {
    var self = this;
    async.map(items, function(item, cb) {
      self.getRepoFile(user, repo, item, cb);
    }, function(err, files) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, files);
      }
    });
  },

  repoSha: function( user, repo, path, token, callback ){
    var url = 'https://api.github.com/repos/'+ user + '/' + repo + '/contents/' + path + ((token) ? '?access_token=' + token : '');
    request({uri: url, json: true}, function( error, response, body ){
      if (!error && response.statusCode == 200) {
        if ( body.message ){
          callback( body.message, null);
        } else {
          callback( null, body.sha );
        }
      } else {
        callback('Error: could not get sha for '+ url, null);
      }
    });
  },

  gist: function( options, callback ){
    var url = 'https://api.github.com/gists/' + options.id + ((options.token) ? '?access_token=' + options.token : '');
    request.get({uri: url, json: true}, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        geojson = [];

        for ( var f in body.files ){
          var file = body.files[f],
              content = file.content;

          try {
            var json = JSON.parse( content );
            if (json.type && json.type == 'FeatureCollection'){
              json.name = file.filename;
              json.updated_at = body.updated_at;
              geojson.push( json );
            }
          } catch (e){
            callback('Error: could not parse file contents'+e, null);
          }

        }
        if ( geojson.length ){
          callback( null, geojson );
        } else {
          callback('Error: could not find any geojson in gist #' + id, null);
        }
      } else if (response.statusCode == 404) {
        callback("Gist not found at: " + url, null);
      } else {
        callback("Error '" + error + "' occurred reading from " + url, null);
      }
    });
  },

  gistSha: function( id, token, callback ){
    var url = 'https://api.github.com/gists/' + id + ((token) ? '?access_token=' + token : '');
    request({uri: url, json: true}, function( error, response, body ){
      if (!error && response.statusCode == 200) {
        if ( body.message ){
          callback( body.message, null);
        } else {
          callback( null, body.updated_at );
        }
      } else {
        callback('Error: could not get gist at '+ url, null);
      }
    });
  }
};
