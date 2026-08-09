scp C:\DEV\Pancho-OS\gen_key.sh root@178.105.163.120:/tmp/gen_key.sh
ssh root@178.105.163.120 "bash /tmp/gen_key.sh"
scp root@178.105.163.120:/tmp/github_deploy.pub C:\DEV\Pancho-OS\github_deploy.pub
