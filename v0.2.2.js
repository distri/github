(function() {
  var Github, Repository;

  Repository = require("./repository");

  Github = function(tokenPromise) {
    var api, lastRequest, token;
    token = null;
    if (tokenPromise != null) {
      tokenPromise.then(function(tokenValue) {
        return token = tokenValue;
      });
    }
    lastRequest = Observable();
    api = function(path, options) {
      var url;
      if (options == null) {
        options = {};
      }
      if (path.match(/^http/)) {
        url = path;
      } else {
        url = "https://api.github.com/" + path;
      }
      options.headers || (options.headers = {});
      if (token) {
        options.headers["Authorization"] = "token " + token;
      }
      options = Object.extend({
        url: url,
        type: "GET",
        dataType: 'json'
      }, options);
      return $.ajax(options).done(function(data, status, request) {
        return lastRequest(request);
      }).fail(lastRequest);
    };
    return {
      api: api,
      markdown: require('./markdown')(api),
      lastRequest: lastRequest,
      token: function(newValue) {
        if (arguments.length > 0) {
          return token = newValue;
        } else {
          return token;
        }
      },
      Repository: function(data) {
        if (data == null) {
          data = {};
        }
        Object.defaults(data, {
          requester: api
        });
        return Repository(data);
      },
      repository: function(fullName) {
        return api("repos/" + fullName).then(function(data) {
          Object.defaults(data, {
            requester: api
          });
          return Repository(data);
        });
      },
      authorizationUrl: Github.authorizationUrl
    };
  };

  Github.authorizationUrl = function(clientId, scope) {
    if (scope == null) {
      scope = "user:email";
    }
    return "https://github.com/login/oauth/authorize?client_id=" + clientId + "&scope=" + scope;
  };

  module.exports = Github;

}).call(this);
