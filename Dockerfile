FROM node:18-alpine as build
WORKDIR /app
COPY frontend/ ./frontend/
COPY customer-site/ ./customer-site/
RUN cd frontend && npm install && npm run build
RUN cd customer-site && npm install && npm run build

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=build /app/frontend/build ./static/admin
COPY --from=build /app/customer-site/build ./static/customer
RUN mkdir -p uploads
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
