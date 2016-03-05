Repsoitory
==========

`Repository` wraps the concept of a Github repository. It includes additional
data for the local working copy such as the current branch.

All of the methods return promises to allow for easy chaining and error
reporting.

    ApiGenerator = require('./api_generator')
    Composition = require "model"
    {defaults, extend} = require "./lib/util"

Constructor
-----------

Currently the only parameter needed to initialize a repository instance is a
`url`. This url is used as a base for the api calls.

    Repository = (I={}) ->
      defaults I,
        branch: null
        default_branch: "master"

      # Requester only matters runtime, not real data
      # TODO: This is kind of a hack
      requester = I.requester
      delete I.requester

      self = Composition(I)

      self.attrObservable Object.keys(I)...

      # TODO: Think about converting underscored properties to camel case in an
      # automatic and consistent way.

      self.defaultBranch = ->
        I.default_branch

      # Initialize chosen branch to default branch
      unless self.branch()
        self.branch(self.defaultBranch())

Get api helper methods from the api generator. With them we can do things like
`get "branches"` to list branches of this repo.

      {get, put, post, patch} = ApiGenerator self.url, requester

      self.extend
        infoDisplay: ->
          "#{I.fullName} (#{self.branch()})"

        pullRequests: ->
          get "pulls"

        createPullRequest: ({title}) ->
          head = title.dasherize()

          self.switchToBranch(head)
          .then(self.commitEmpty)
          .then ->
            post "pulls",
              base: self.defaultBranch()
              head: head
              title: title

        latestCommit: (branch=self.branch()) ->
          get("git/refs/heads/#{branch}#{cacheBuster()}")
          .then (data) ->
            if Array.isArray data
              throw status: 404
            else
              get data.object.url

        latestContent: (branch=self.branch()) ->
          self.latestCommit(branch)
          .then (data) ->
            get "#{data.tree.url}?recursive=1"
          .then (data) ->
            files = data.tree.filter (file) ->
              file.type is "blob"

            # Gather the data for each file
            Promise.all files.map (datum) ->
              get(datum.url)
              .then (data) ->
                extend(datum, data)

        commitTree: ({branch, message, baseTree, tree, empty}) ->
          branch ?= self.branch()
          message ?= "Updated at https://danielx.net/editor/"

          # TODO: Is there a cleaner way to pass this through promises?
          latestCommitSha = null

          self.latestCommit(branch)
          .then (data) ->
            latestCommitSha = data.sha

            if baseTree is true
              baseTree = data.tree.sha

            if empty is true
              return data.tree
            else
              tree = cleanTree(tree)

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

Creates ref (if it doesn't already exist) using our current branch as a base.

        createRef: (ref) ->
          get("git/refs/heads/#{self.branch()}")
          .then (data) ->
            post "git/refs",
              ref: ref
              sha: data.object.sha

        switchToBranch: (branch) ->
          ref = "refs/heads/#{branch}"

          setBranch = (data) ->
            self.branch(branch)

            return data

          get("git/#{ref}")
          .then (result) ->
            # As an undocument "feature" GH returns an array of heads matching a
            # prefix if no exact match is found
            if Array.isArray result
              throw status: 404
            else
              setBranch(result) # Success
          .catch (request) -> # Failure
            branchNotFound = (request.status is 404)

            if branchNotFound
              self.createRef(ref)
              .then(setBranch)
            else
              throw request

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
              content: "created by strd6.github.io/editor"
              mode: "100644"
              path: "tempest.txt"
              type: "blob"
            }]
          .then (data) ->
            post "git/commits",
              message: "Initial commit"
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
              self.initPublishBranch(publishBranch)

Publish our package for distribution by taking a tree and adding it to the
`gh-pages` branch after making sure that branch exists.

        publish: (tree, message, publishBranch=self.publishBranch()) ->
          self.ensurePublishBranch(publishBranch).then ->
            self.commitTree
              baseTree: true
              message: message
              tree: tree
              branch: publishBranch

Expose our API methods.

      extend self,
        get: get
        put: put
        post: post
        patch: patch

      return self

    module.exports = Repository

Helpers
-------

    cacheBuster = ->
      "?#{+ new Date}"

The subset of data appropriate to push to github.

    cleanTree = (data) ->
      data.map (datum) ->
        {path, mode, type, sha, initialSha, content} = datum
        # TODO: This SHA biz should be coordinated with filetree better
        if sha and (initialSha is sha)
          {path, mode, type, sha}
        else
          {path, mode, type, content}
      .filter (file) ->
        if file.content or file.sha
          true
        else
          console.warn "Blank content for: ", file
          false
