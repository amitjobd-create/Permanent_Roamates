# UKPCS Death Book Engine

This folder is dedicated to the UKPCS quiz/error workflow.

## Data flow

Quiz -> error event -> error queue -> 7 PM processor -> Death Book -> adaptive quiz

## Files

- `error_queue.json` — persistent wrong-answer queue.
- `master_errors.json` — structured Death Book index.
- `quiz_config.json` — quiz/processing rules.
- `automation_bridge.md` — integration notes.

## Privacy

This repository is public. Do not store passwords, API keys, tokens, personal documents, or sensitive information here.

Study questions and answer history are being stored here because the user explicitly approved use of this public repository.
