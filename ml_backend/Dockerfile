FROM python:3.14-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
COPY utils ./utils
COPY models ./models

EXPOSE 5050
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5050} --workers 1 --threads 4 app:app"]
