import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { formatRatingValue } from '../js/ratingDisplay';

const Comments = () => {
  const navigate = useNavigate();
  const [commentsData, setCommentsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
      } catch (err) {
        setError('Failed to fetch comments.');
      }
      setLoading(false);
    };
    fetchComments();
  }, []);

  return (
    <div className="min-h-screen w-full bg-white overflow-y-auto">
      <Navbar />
      <div className="pt-24 p-4 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-apple-large font-light text-black mb-3">Your Comments</h1>
            <div className="w-16 h-0.5 bg-black mx-auto mb-4"></div>
            <p className="text-apple-subheadline text-apple-gray-600 font-light">
              View all the comments and ratings you've submitted for rushees
            </p>
          </div>
          {loading ? (
            <div className="card-apple p-8 text-center">
              <p className="text-apple-footnote text-apple-gray-600 font-light">Loading...</p>
            </div>
          ) : error ? (
            <div className="card-apple p-8 text-center">
              <p className="text-red-600">{error}</p>
            </div>
          ) : commentsData.length === 0 ? (
            <div className="card-apple p-8 text-center">
              <p className="text-apple-footnote text-apple-gray-600 font-light">You haven't commented on any rushees yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {commentsData.map((entry, idx) => (
                <div
                  key={idx}
                  className="card-apple p-6 hover:border-apple-gray-300 transition-all duration-200"
                >
                  <div className="flex flex-col md:flex-row items-start gap-6">
                    <img
                      src={entry.rushee.image_url}
                      alt={`${entry.rushee.first_name} ${entry.rushee.last_name}`}
                      className="w-24 h-24 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                    />
                    <div className="flex-1 w-full">
                      {/* Rushee name + Night badge */}
                      <div className="flex flex-row items-center mb-4">
                        <h2 className="text-apple-title1 font-normal text-black">
                          {entry.rushee.first_name} {entry.rushee.last_name}
                        </h2>
                        {entry.comments[0]?.night?.name && (
                          <span className="ml-auto bg-apple-gray-100 text-apple-gray-700 text-apple-caption1 font-light px-2 py-1 rounded-apple whitespace-nowrap">
                            {entry.comments[0].night.name}
                          </span>
                        )}
                      </div>

                      {/* Comments */}
                      {entry.comments.map((comment, cidx) => (
                        <div key={cidx} className="mb-6 last:mb-4">
                          <div className="flex flex-col gap-3 mb-3">
                            <div className="flex items-start gap-3">
                              <p className="text-apple-body text-black font-light flex-1">{comment.comment}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {comment.ratings && comment.ratings.map((rating, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                                >
                                  {rating.name}: {formatRatingValue(rating.value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => navigate(`/brother/rushee/${entry.rushee.gtid}`)}
                        className="btn-apple px-6 py-3 text-apple-body font-light"
                      >
                        View full profile
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Comments;
