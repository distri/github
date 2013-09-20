    Repository = require "./repository"

Github handles our connections to the Github API. May be optionally passed a
promise that when fulfilled will set the authorization token.

    Github = (tokenPromise) ->

Our OAuth token for making API requests. We can still make anonymous requests
without it.

      token = null
      
      tokenPromise?.then (tokenValue) ->
        token = tokenValue
        
Hold an observable for the last request so we can track things like oauth scopes
and rate limit.

      lastRequest = Observable()

Make a call to the github API. The path can be either a relative path such as
`users/STRd6` or an absolute path like `https://api.github.com/users/octocat` or
`user.url`.

We attach our `accessToken` if present.

`api` returns a promise for easy chaining.

      api = (path, options={}) ->
        if path.match /^http/
          url = path
        else
          url = "https://api.github.com/#{path}"
        
        options.headers ||= {}
        
        if token
          options.headers["Authorization"] = "token #{token}"
    
        options = Object.extend
          url: url
          type: "GET"
          dataType: 'json'
        , options

Perform the ajax call and observe requests on success or failure

        $.ajax(options).done (data, status, request) ->
          lastRequest(request)
        .fail lastRequest

Publicly expose `api` method.

      api: api

Also expose `lastRequest`.

      lastRequest: lastRequest

Getter/Setter for auth token.

      token: (newValue) ->
        if arguments.length > 0
          token = newValue
        else
          token

Expose the `Repository` constructor so that others can create repositories from
raw data.

      Repository: (data={}) -> 
        # Use our api for the repository
        Object.defaults data,
          requester: api

        Repository(data)

Get a repository, returns a promise that will have a repository one day.

      repository: (fullName) ->
        # TODO: Consider returning a repository proxy immediately
        #   may need to be weighed carefully with the tradeoffs of observables.
        # TODO: Consider creating from a full url in addition to a full name.

        api("repos/#{fullName}")
        .then (data) ->
          Object.defaults data,
            requester: api

          Repository(data)

Expose `authorizationUrl` to instances as well.

      authorizaionUrl: Github.authorizationUrl

A URL that will authorize a user with the specified scope for the given app.

    Github.authorizationUrl = (clientId, scope="user:email") ->
      "https://github.com/login/oauth/authorize?client_id=#{clientId}&scope=#{scope}"

    module.exports = Github
