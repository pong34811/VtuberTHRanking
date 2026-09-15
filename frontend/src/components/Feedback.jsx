export default function Feedback({ error, retry, children }) {
  return (
    <div className="feedback" role={error ? "alert" : "status"}>
      <p>{error || children}</p>
      {retry && (
        <button className="secondary-button" onClick={retry}>
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}
