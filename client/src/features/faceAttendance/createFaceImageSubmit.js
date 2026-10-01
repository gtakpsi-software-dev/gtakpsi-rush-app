export function createFaceImageSubmit({
    image,
    api,
    loadModel,
    base64ToTensor,
    get,
    navigate,
    setLoading,
    setPage,
    setRushee,
    warn,
    log,
}) {
    return async () => {
        setLoading(true);

        let vector;

        try {
            const model = await loadModel();
            const tensor = await base64ToTensor(image, model);
            const embeddings = model.infer(tensor, "conv_preds");
            vector = Array.from(embeddings.dataSync());
            log(typeof vector);
        } catch (err) {
            log(err);

            const errorTitle = "Couldn't Process your Face";
            const errorDescription = "While vectorizing your face, there was an issue.";

            navigate(`/error/${errorTitle}/${errorDescription}`);
            return;
        }

        await get(`${api}/rushee/get-rushee-face`, vector)
            .then((response) => {
                if (response.data.status === "success") {
                    setPage(1);
                    setRushee(response.data.payload);
                    log(response.data.payload);
                } else {
                    warn(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: false,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "colored",
                    });
                }
            })
            .catch((error) => {
                log(error);

                warn(`Some internal error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "colored",
                });
            });

        setLoading(false);
    };
}
