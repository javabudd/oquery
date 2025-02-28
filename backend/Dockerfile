FROM python:3.13.2

COPY requirements.txt .

RUN python -m pip install -r requirements.txt

COPY server.py .
COPY tools/ ./tools/
COPY .env .

CMD ["python", "server.py"]