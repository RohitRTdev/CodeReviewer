import { useState, useEffect } from 'react';
import checkSession, { getUser, type RepoDetails, getRepos, getUserRepos, setRepos } from './user.ts';

function MainContent() {
  const [showMode, setshowMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savedRepos, setSavedRepos] = useState<RepoDetails[]>([]);
  const [userRepos, setUserRepos] = useState<RepoDetails[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    async function fetchSavedRepos() {
      setLoading(true);
      const res = await getRepos();
      setSavedRepos(res);
      if (res.length === 0) {
        const userRepos = await getUserRepos();
        setUserRepos(userRepos);
      }
      setLoading(false);
    }

    fetchSavedRepos();
  }, []);

  async function fetchUserRepos() {
    const res = await getUserRepos();
    setUserRepos(res);
  }

  function toggle(id: number) {
    // Include the id if it is not present
    // Remove it if it is present
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    ); 
  }

  async function toggleShowMode() {
    if (!showMode) {
      const repos = userRepos.filter(e => selected.includes(e.id));
      const isSet = await setRepos(repos);
      if (isSet) {
        setSavedRepos(repos);
      }
    }

    setshowMode(prev => !prev);
    setSelected([]);
  }

  if (savedRepos.length === 0 || !showMode) {
    return (
      <div>
      {!showMode && (
        <ul>
          {
            userRepos.map(repo => 
              <li key={repo.id}>
                <label>
                  <input 
                    type="checkbox"
                    checked={selected.includes(repo.id)}
                    onChange={() => toggle(repo.id)}
                  />   
                  {repo.name}
                </label>  
              </li>
            )
          }
        </ul>
      )}
      <button disabled={loading} onClick={async () => {
        if (loading) {
          return;
        }

        setLoading(true);
        await toggleShowMode();
        setLoading(false);
      }}>
        {loading === true ? "Loading..." : "Select repos"}
      </button>
      </div>
    );
  }
  else {
    return (
      <div>
        <ul>
          {
            savedRepos.map(repo =>
              <li key={repo.id}>{repo.name}</li>
            )
          }
        </ul>
        <button disabled={loading} onClick={ async () => {
            if (loading) {
              return;
            }

            setLoading(true);
            await fetchUserRepos();

            setLoading(false); 
            setSelected([]);
            setshowMode(false); 
        }}>
          {loading === true ? "Loading..." : "Select new repos"}
        </button>
      </div>

    );
  }
}

function Dashboard({ user } : { user: string }) {  
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
      <MainContent></MainContent>
    </div>
    </>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [button, setButton] = useState(false);
  const [user, setUser] = useState("user");
  
  useEffect(() => {
    async function setSessionParams() {
      const isValid = await checkSession();
      setLoading(false);
      setButton(!isValid);

      if (isValid) {
        setUser(await getUser());
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
      <Dashboard user={user}></Dashboard>
    );
  }
}

export default App;
