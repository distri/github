Markdown
========

Expose Github's Markdown API.

    module.exports = (api) ->
      (source) ->
        api "markdown",
          type: "POST"
          dataType: "text"
          data: JSON.stringify
            text: source
            mode: "markdown"
