import { useState, useEffect } from 'react';
import checkSession, { getUser, type RepoDetails, getRepos, getUserRepos } from './user.ts';

function MainContent({ repos } : { repos: RepoDetails[] }) {
  const [showMode, setshowMode] = useState(true);
  const [userRepos, setuserRepos] = useState<RepoDetails[]>([]);

  useEffect(() => {
    async function fetchUserRepos() {
      const res = await getUserRepos();
      setuserRepos(res);
    }
    if (!showMode) {
      fetchUserRepos();
    }
  }, [showMode]);


  if (repos.length === 0) {
    return (
      <div>
      {!showMode && (
        <ul>
          {
            userRepos.map(repo => 
              <li key={repo.id}>{repo.name}</li>
            )
          }
        </ul>
      )}
      <button onClick={() => setshowMode(prev => !prev)}>
        Select repos
      </button>
      </div>
    );
  }
  else {
    return (
      <ul>
        {
          repos.map(repo =>
            <li key={repo.id}>{repo.name}</li>
          )
        }
      </ul>
    );
  }
}

function Dashboard({ user, repos } : { user: string, repos: RepoDetails[] }) {  
  return (
    <>
    <div className="navbar">
      <h1>Welcome {user}!</h1>
      <div id="logout-button">
        <button onClick={() => {window.location.href="/api/logout"}}>
          Logout
        </button>
      </div>
    </div>
    <div className="centered-elem">
      <MainContent repos={repos}></MainContent>
    </div>
    </>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [button, setButton] = useState(false);
  const [user, setUser] = useState("user");
  const [repos, setRepos] = useState<RepoDetails[]>([]);

  useEffect(() => {
    async function setSessionParams() {
      const isValid = await checkSession();
      setLoading(false);
      setButton(!isValid);

      if (isValid) {
        setUser(await getUser());
        setRepos(await getRepos());
      }
    }

    setSessionParams();
  }, []);


  if (loading) {
    return <div className="centered-elem"><h1>Loading....</h1></div>;
  }

  if (button) {
    return (
      <div className="centered-elem">
        <button id="login-button" onClick={() => window.location.href="/api/login"}>
          Login with github
        </button>
      </div>
    );
  }
  else {
    return (
      <Dashboard user={user} repos={repos}></Dashboard>
    );
  }
}

export default App;
