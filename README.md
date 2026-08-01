# Description
Codereviewer analyzes your PR to check for simple logic bugs and does basic code cleanliness checks using AI. Any time you create a PR in github or push changes to an existing PR, the reviewer would post comments on it to help you catch bugs.

## Setup
Currently there is no live version of this. So you'll need to set up the server locally and open up a public domain using a tool like <b>ngrok</b>
```
./setup.sh all
```
This installs npm dependencies, creates a base <i>.env</i> file and runs db migrations for you. Before you can run the server, you need to fill in the remaining variables in newly created <b>backend/.env</b> file. This includes things like a GEMINI_API key, a github OAuth api key and domain.

## Usage
To run, use 
```
./setup.sh run
```
Once server is running, go to http://localhost:8000. You'll be presented with an option to login to the site using your github account. Once done, select the <b>Select repos</b> button to display a list of your github repos. Now select the repositories you wish to enable the AI PR service in and then click on the <b>Select repos</b> button again. 
<br>
Now you may start creating PR's and pushing new code changes to them. If the repository was selected, then within a few minutes you should be able to see the review comments.
<br>
<br>
To stop the service, run
```
./setup.sh stop
```
When running these services, the database is created on your local machine. If you have finished testing and wish to remove it, then run 
```
./setup.sh reset
```
