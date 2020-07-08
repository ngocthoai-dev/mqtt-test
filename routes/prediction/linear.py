import numpy as np# create dummy data for training
import torch
from torch.nn import Module
from torch.autograd import Variable
import pandas as pd

class linearRegression(Module):
    def __init__(self, inputSize, outputSize):
        super(linearRegression, self).__init__()
        self.actifunc = torch.nn.ReLU()
        self.hidden = torch.nn.Linear(inputSize, inputSize)
        self.output = torch.nn.Linear(inputSize, outputSize)
        

    def forward(self, x):
        hidden = self.actifunc(self.hidden(x))
        out = self.actifunc(self.output(hidden))
        
        return out

def train(X, y, epochs=10000, learningRate=0.001):
    inputDim = X.shape[1]        # takes variable 'x' 
    outputDim = y.shape[1]       # takes variable 'y'
    learningRate = learningRate
    epochs = epochs

    model = linearRegression(inputDim, outputDim)
    ##### For GPU #######
    if torch.cuda.is_available():
        model.cuda()

    criterion = torch.nn.MSELoss() 
    optimizer = torch.optim.Adam(model.parameters(), lr=learningRate)

    prevLoss = 0

    for epoch in range(epochs):
        # Converting inputs and labels to Variable
        if torch.cuda.is_available():
            inputs = Variable(torch.from_numpy(x_train).cuda())
            labels = Variable(torch.from_numpy(y_train).cuda())
        else:
            inputs = Variable(torch.from_numpy(x_train))
            labels = Variable(torch.from_numpy(y_train))

        # Clear gradient buffers because we don't want any gradient from previous epoch to carry forward, dont want to cummulate gradients
        optimizer.zero_grad()

        # get output from the model, given the inputs
        outputs = model(inputs)

        # get loss for the predicted output
        loss = criterion(outputs, labels)

        # get gradients w.r.t to parameters
        loss.backward()

        # update parameters
        optimizer.step()

        if abs(loss-prevLoss) < 10e-6:
            break
        
        print('epoch {}, loss {}'.format(epoch, loss.item()))

    torch.save(model, r'./save/weight.pth')

def predict(sample):
    model  = torch.load(r'./save/weight.pth')
    model.eval()
    
    with torch.no_grad(): # we don't need gradients in the testing phase
        if torch.cuda.is_available():
            predicted = model(Variable(torch.from_numpy(sample).cuda())).cpu().data.numpy()
        else:
            predicted = model(Variable(torch.from_numpy(sample))).data.numpy()

    return predicted
    

x_values = [(i, j) for j in range(50) for i in range(50)]
x_train = np.array(x_values, dtype=np.float32)
x_train = x_train.reshape(-1, 2)

y_values = [i+j for (i, j)in x_values]
y_train = np.array(y_values, dtype=np.float32)
y_train = y_train.reshape(-1, 1)

model = train(x_train,y_train)
print(predict(x_train[1]))
    
