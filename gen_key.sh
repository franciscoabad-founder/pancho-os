#!/bin/bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -q
cat ~/.ssh/github_deploy.pub > /tmp/github_deploy.pub
