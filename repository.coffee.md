Repsoitory
==========

`Repository` wraps the concept of a Github repository. It includes additional
data for the local working copy such as the current branch.

All of the methods return promises to allow for easy chaining and error
reporting.

    ApiGenerator = require('./api_generator')

An emoji generator to make commits pop!

    emojer = require "emojer"

    emojis = ->
      "#{emojer()}#{emojer()}"

Constructor
-----------

Currently the only parameter needed to initialize a repository instance is a
`url`. This url is used as a base for the api calls.

    Repository = (I={}) ->
      Object.defaults I,
        branch: "master"
        defaultBranch: "master"

      # Requester only matters runtime, not real data
      # TODO: This is kind of a hack
      requester = I.requester
      delete I.requester

      # TODO: Think about converting underscored properties to camel case in an
      # automatic and consistent way.

      self = Model(I).observeAll()

Get api helper methods from the api generator. With them we can do things like
`get "branches"` to list branches of this repo.

      {get, put, post, patch} = ApiGenerator self.url, requester

      self.extend
        infoDisplay: ->
          "#{I.fullName} (#{I.branch})"

        pullRequests: ->
          get "pulls"

        createPullRequest: ({title}) ->
          head = title.dasherize()

          self.switchToBranch(head)
          .then(self.commitEmpty)
          .then ->
            post "pulls",
              base: I.defaultBranch
              head: head
              title: title

        latestCommit: (branch=self.branch()) ->
          get("git/refs/heads/#{branch}")
          .then (data) ->
            get data.object.url

        latestContent: (branch=self.branch()) ->
          self.latestCommit(branch)
          .then (data) ->
            get "#{data.tree.url}?recursive=1"
          .then (data) ->
            files = data.tree.select (file) ->
              file.type is "blob"

            # Gather the data for each file
            $.when.apply(null, files.map (datum) ->
              get(datum.url)
              .then (data) ->
                Object.extend(datum, data)
            )
          .then (results...) ->
            results

        commitTree: ({branch, message, baseTree, tree, empty}) ->
          branch ?= self.branch()
          message ?= "#{emojis()} Updated in browser at strd6.github.io/editor"

          # TODO: Is there a cleaner way to pass this through promises?
          latestCommitSha = null

          self.latestCommit(branch)
          .then (data) ->
            latestCommitSha = data.sha

            if baseTree is true
              baseTree = data.tree.sha

            if empty is true
              Deferred().resolve(data.tree)
            else
              post "git/trees",
                base_tree: baseTree
                tree: tree
          .then (data) ->
            # Create another commit
            post "git/commits",
              parents: [latestCommitSha]
              message: message
              tree: data.sha
          .then (data) ->
            # Update the branch head
            patch "git/refs/heads/#{branch}",
              sha: data.sha

        # TODO: this is currently a hack because we can't create a pull request
        # if there are no different commits
        commitEmpty: ->
          self.commitTree
            empty: true
            message: "This commit intentionally left blank"

        switchToBranch: (branch) ->
          ref = "refs/heads/#{branch}"

          setBranch = (data) ->
            self.branch(branch)

            return data

          get("git/#{ref}")
          .then setBranch # Success
          , (request) -> # Failure
            branchNotFound = (request.status is 404)

            if branchNotFound
              # Create branch if it doesn't exist
              # Use our current branch as a base
              get("git/refs/heads/#{self.branch()}")
              .then (data) ->
                post "git/refs",
                  ref: ref
                  sha: data.object.sha
              .then(setBranch)
            else
              Deferred().reject(arguments...)

        mergeInto: (branch=self.defaultBranch()) ->
          post "merges",
            base: branch
            head: self.branch()

        pullFromBranch: (branch=self.defaultBranch()) ->
          post "merges",
            base: self.branch()
            head: branch

The default branch that we publish our packaged content to.

        publishBranch: ->
          "gh-pages"

Initialize the publish branch, usually `gh-pages`. We create an empty
tree and set it as a root commit (one with no parents). Then we create
the branch referencing that commit.

        initPublishBranch: (branch=self.publishBranch()) ->
          # Post an empty tree to use for the base commit
          # TODO: Learn how to post an actually empty tree
          post "git/trees",
            tree: [{
              mode: "1006444"
              path: "tempest.txt"
              content: "created by strd6.github.io/editor"
            }]
          .then (data) ->
            post "git/commits",
              message: "Initial commit #{emojis()}"
              tree: data.sha
          .then (data) ->
            # Create the branch from the base commit
            post "git/refs",
              ref: "refs/heads/#{branch}"
              sha: data.sha

Ensure our publish branch exists. If it is found it returns a promise that
succeeds right away, otherwise it attempts to create it. Either way it
returns a promise that will be fullfilled if the publish branch is legit.

        ensurePublishBranch: (publishBranch=self.publishBranch()) ->
          get("branches/#{publishBranch}")
          .then null, (request) ->
            if request.status is 404
              self.initPublishBranch()

Publish our package for distribution.

We currently publish a `<branch>.json`, `<branch>.js`, and `<branch>.html`.

The json is the self contained package for use in any other application. The js is
an alternative for including as script tag on a page. And the html is a standalone
demo page.

If we are on the defaut branch we publish an additional `index.html` as
a demo page.

        publish: (data) ->
          branch = self.branch()
          message = "#{emojis()} Built #{branch} in browser in strd6.github.io/editor"

          name = branch

          # Assuming git repo with gh-pages branch
          publishBranch = self.publishBranch()

          tree = Object.keys(data).map (extension) ->
            path: "#{name}.#{extension}"
            content: data[extension]

          if branch is self.defaultBranch()
            tree.push
              path: "index.html"
              content: data.html

          self.ensurePublishBranch(publishBranch).then ->
            self.commitTree
              baseTree: true
              tree: tree
              branch: publishBranch

Expose our API methods.

      Object.extend self,
        get: get
        put: put
        post: post
        patch: patch

      return self

    module.exports = Repository
