const WikiArticleIntegrator = async (agent, { query, currentSolution = '' }) => {
  const htmlResult = await agent.chat([
    {
      role: 'user',
      content: `BACKGROUND: ${currentSolution}\n\nQUERY: ${query}\nAdhere to the following HTML template:\n\n<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Article Name</title>
          <link rel="stylesheet" href="./styles.css">
      </head>
      <body>
          <div class="header">
            <h1>Article Name</h1>
          </div>
          <div class="content">
            <div class="infobox">
              <div class="infobox-title">Article Name</div>
              <div class="infobox-image">
                <img src="placeholder.img" alt="Article Name" style="width: 100%;">
                <p><i>A description.</i></p>
              </div>
              <div class="infobox-data">
                <dt>Key</dt>
                <dd>Value</dd>
              </div>
            </div>
              <p>Lorem ipsum dolor sit amet.</p>
              <h2>Section Heading</h2>
              <p>Lorem ipsum dolor sit amet.</p>
              <h2>Section Heading</h2>
              <p>Lorem ipsum dolor sit amet.</p>
              <h2>See Also</h2>
              <ul>
                <li><a href="./Article.html">Another Article</a></li>
              </ul>
          </div>
      </body>
      </html>\n\nOutput the entire new HTML file only. Don't include any other details in your response.`
    }
  ]);

  return `SOLUTION: ${htmlResult}\n\nQUERY: ${query}`
};

export default WikiArticleIntegrator;
