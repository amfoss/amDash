FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --upgrade pip
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt


FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

ENV PYTHONUNBUFFERED=1

# DB lives on a mounted volume — /data is the expected mount point.
ENV DB_PATH=/data/amdash.db

CMD ["python", "scheduler.py"]
