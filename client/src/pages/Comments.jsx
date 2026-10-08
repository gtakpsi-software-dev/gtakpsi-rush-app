import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommentsView from "../features/comments/CommentsView";

// Load the current brother’s comments and connect profile navigation to the view.
const Comments = () => {
  const navigate = useNavigate();
  const [commentsData, setCommentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
      // Fetch the brother’s comments when the page mounts.
    // Request comments by the stored brother name and update loading or error state.
    const fetchComments = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.firstname || !user.lastname) {
          setError('User not logged in.');
          setLoading(false);
          return;
        }
        const brotherName = `${user.firstname} ${user.lastname}`;
        const api = import.meta.env.VITE_API_PREFIX || '';
        const apiKey = import.meta.env.VITE_API_KEY;
        const headers = {};
        if (apiKey) {
          headers['X-API-Key'] = apiKey;
        }
        const res = await fetch(`${api}/brother/comments/${encodeURIComponent(brotherName)}`, { headers });
        const data = await res.json();
        if (data.status === 'success') {
          setCommentsData(data.payload);
        } else {
          setError(data.message || 'Failed to fetch comments.');
        }
      } catch {
        setError('Failed to fetch comments.');
      }
      setLoading(false);
    };
    fetchComments();
  }, []);

  return (
    <CommentsView
      loading={loading}
      error={error}
      commentsData={commentsData}
      onOpenProfile={/* Open the profile for the selected GTID. */ (gtid) => navigate(`/brother/rushee/${gtid}`)}
    />
  );
};

export default Comments;
