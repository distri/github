Testing our Github API wrapper. Currently super hacky, but time heals all.

    window.Github = require "../main"

    describe "Github", ->
      it "Should be able to construct repositories", ->
        assert Github().repository

        assert Github().Repository

      it "should have authorizationUrl as an instance method", ->
        assert Github().authorizationUrl

      describe "Repository", ->

Hacky way to test requests. We just see if it returns a URL that looks ok.

        expected = null
        expectUrlToMatch = (regex) ->
          expected = regex

        testRequester = (url, data) ->
          match = url.match(expected)
          assert.equal !!match, true, """
            #{url} did not match #{expected}, #{match}
          """

          then: ->

        repository = Github().Repository
          url: "STRd6/testin"
          requester: testRequester

        it "should cache bust the latest commit", ->
          expectUrlToMatch /.*\?\d+/

          repository.latestCommit()

        it "should create a merge when asked", ->
          expectUrlToMatch /STRd6\/testin\/merges/

          repository.mergeInto()

      it "should expose an API method to make requests", (done) ->
        Github().api("rate_limit").then (data) ->
          done()

      it "should get some files", (done) ->
        @timeout 2000
        gh = Github()

        gh.repository("STRd6/testin2")
        .then (repo) ->
          repo.latestContent().then (data) ->
            done()
